from __future__ import annotations


import importlib.util
import json
import re
import sys
from pathlib import Path
from typing import Any, Callable

from agent.io.excel import read_sheet_as_dicts, update_contact_column
from agent.models import ContactInfo, RunContext
from agent.utils.text import dedupe_keep_order


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?<!\w)(?:\+?\d{1,4}[-\s().]*)?(?:\d[-\s().]*){7,13}\d(?!\w)")
URL_RE = re.compile(r"https?://[^\s；;，,）)]+", re.I)


class ContactStage:
    name = "contacts"

    def __init__(self) -> None:

        self._external_module: Any | None = None
        self._last_raw: dict[str, Any] = {}

    def run(self, ctx: RunContext, mapping_files: list[Path], progress_callback: Callable[[dict[str, Any]], None] | None = None) -> dict[str, int]:
        self._external_module = self._load_external(ctx.config.get("external_contact_crawler_path"))
        summary: dict[str, int] = {}
        prepared = [(path, read_sheet_as_dicts(path)) for path in mapping_files]
        total_rows = sum(len(rows) for _, rows in prepared)
        processed_rows = 0

        evidence_rows: list[dict[str, Any]] = []
        _emit_progress(progress_callback, {"stage": "contacts", "current": 0, "total": total_rows, "message": "开始读取公司列表"})
        for path, rows in prepared:
            contacts: dict[str, str] = {}
            for row in rows:
                company = str(row.get("公司名称") or "").strip()
                if not company or "待补充" in company:
                    continue

                self._last_raw = {}
                contact = self.lookup_company(company, ctx)
                evidence_rows.append({"company": company, **self._last_raw})
                if contact.to_prd_string():
                    contacts[company] = contact.to_prd_string()
                processed_rows += 1
                _emit_progress(progress_callback, {"stage": "contacts", "current": processed_rows, "total": total_rows, "message": f"已检查：{company}"})
            summary[str(path)] = update_contact_column(path, contacts)

        ctx.reports_dir.mkdir(parents=True, exist_ok=True)
        evidence_output = ctx.reports_dir / "contact_evidence.json"
        evidence_output.write_text(json.dumps(evidence_rows, ensure_ascii=False, indent=2), encoding="utf-8")
        ctx.manifest[self.name] = {"updated_files": summary, "total_rows": total_rows, "processed_rows": processed_rows, "evidence_output": str(evidence_output)}
        _emit_progress(progress_callback, {"stage": "contacts", "current": processed_rows, "total": total_rows, "message": "联系方式阶段完成"})
        return summary

    def lookup_company(self, company: str, ctx: RunContext) -> ContactInfo:
        if self._external_module and hasattr(self._external_module, "crawl_company"):
            try:
                raw = self._external_module.crawl_company(
                    company,
                    max_pages=int(ctx.config.get("max_contact_pages_per_company", 12)),
                    delay=float(ctx.config.get("request_delay_seconds", 0.3)),
                )

                self._last_raw = {"evidence": raw.get("evidence", []), "issues": raw.get("issues", []), "searched_urls": raw.get("searched_urls", []), "source_counts": raw.get("source_counts", {})}
                return self._from_external_result(raw)
            except Exception as exc:  # noqa: BLE001 - one company must not stop the batch.
                return ContactInfo(note=f"external crawler failed: {exc!r}")
        return ContactInfo()

    def _load_external(self, path_value: str | None) -> Any | None:
        if not path_value:
            return None
        path = Path(path_value)
        if not path.exists():
            return None
        spec = importlib.util.spec_from_file_location("external_contact_crawler_sources", path)
        if not spec or not spec.loader:
            return None
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
        return module

    def _from_external_result(self, raw: dict[str, Any]) -> ContactInfo:
        phones: list[str] = []
        emails: list[str] = []
        websites: list[str] = []
        urls: list[str] = []
        for item in raw.get("evidence", []):
            value = str(item.get("value") or "").strip()
            url = str(item.get("url") or "").strip()
            ctype = str(item.get("contact_type") or "").lower()
            if url:
                urls.append(url)
            if ctype in {"phone", "mobile"} and value and not self._looks_placeholder(value):
                phones.append(value)
            elif ctype == "email" and EMAIL_RE.fullmatch(value):
                emails.append(value)
            if url.startswith("http"):
                websites.append(self._root_url(url))
        return ContactInfo(
            phones=dedupe_keep_order(phones)[:5],
            websites=dedupe_keep_order(websites)[:2],
            emails=dedupe_keep_order(emails)[:5],
            source_urls=dedupe_keep_order(urls)[:5],
            confidence="高" if phones or emails or websites else "",
        )

    def _root_url(self, url: str) -> str:
        match = re.match(r"(https?://[^/]+)", url)
        return match.group(1) if match else url

    def _looks_placeholder(self, value: str) -> bool:
        digits = re.sub(r"\D", "", value)
        return "5550000000" in digits or (len(digits) >= 7 and len(set(digits[-7:])) == 1)


def _emit_progress(callback: Callable[[dict[str, Any]], None] | None, payload: dict[str, Any]) -> None:
    if not callback:
        return
    try:
        callback(payload)
    except Exception:
        pass



