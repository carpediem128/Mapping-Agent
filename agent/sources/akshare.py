from __future__ import annotations

import importlib.util
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any


@dataclass
class AKShareClient:
    enabled: bool = True
    timeout_seconds: int = 45
    max_news: int = 12
    max_companies: int = 8

    include_statements: bool = True
    include_history: bool = True

    def __post_init__(self) -> None:
        self.secondary_data: list[dict[str, Any]] = []
        self.last_news_meta: dict[str, Any] = {}

    @classmethod
    def from_config(cls, config: dict[str, Any]) -> "AKShareClient":
        settings = config.get("market_data", {}) or {}
        return cls(
            enabled=bool(settings.get("enabled", True)),
            timeout_seconds=int(settings.get("timeout_seconds", 45)),
            max_news=int(settings.get("max_news", 12)),
            max_companies=int(settings.get("max_companies", 8)),

            include_statements=bool(settings.get("include_statements", True)),
            include_history=bool(settings.get("include_history", True)),
        )

    @staticmethod
    def status(config: dict[str, Any]) -> dict[str, Any]:
        settings = config.get("market_data", {}) or {}
        return {
            "provider": "akshare",
            "enabled": bool(settings.get("enabled", True)),
            "installed": importlib.util.find_spec("akshare") is not None,
            "coverage": [
                "板块实时行情",
                "板块成分股",
                "A股实时行情",
                "A股历史行情",
                "公司资料",
                "财务指标",
                "主营构成",
                "个股新闻",
                "财经内容精选",
            ],
            "board_endpoint": "stock_board_concept_name_em",
            "detail_endpoints": [
                "stock_board_concept_cons_em",
                "stock_zh_a_spot_em",
                "stock_zh_a_hist",
                "stock_individual_info_em",
                "stock_financial_analysis_indicator",
                "stock_zygc_em",
                "stock_balance_sheet_by_report_em",
                "stock_profit_sheet_by_report_em",
                "stock_cash_flow_sheet_by_report_em",
                "stock_news_em",
            ],
        }

    def fetch_hotspots(self, allow_keywords: list[str], exclude_keywords: list[str], concept_keywords: dict[str, list[str]] | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        self.secondary_data = []
        if not self.enabled:
            return [], {"status": "disabled", "provider": "akshare"}
        try:
            import akshare as ak
            board_error = ""
            try:
                frame = ak.stock_board_concept_name_em()
            except Exception as exc:
                frame = None
                board_error = f"{type(exc).__name__}: {exc}"
            fund_frame = None
            fund_error = ""
            try:
                fund_frame = ak.stock_fund_flow_concept(symbol="即时")
            except Exception as exc:
                fund_error = f"{type(exc).__name__}: {exc}"
            fund_records = fund_frame.to_dict("records") if fund_frame is not None and hasattr(fund_frame, "to_dict") else []
            fund_by_name = {
                str(item.get("行业") or "").strip().casefold(): item
                for item in fund_records
                if str(item.get("行业") or "").strip()
            }
            source_records = frame.to_dict("records") if frame is not None and hasattr(frame, "to_dict") else fund_records
            if not source_records:
                raise RuntimeError(f"AKShare board/fund endpoints both returned no data; board_error={board_error}; fund_error={fund_error}")
            rows: list[dict[str, Any]] = []
            concept_keywords = concept_keywords or {}
            concept_terms = [term for terms in concept_keywords.values() for term in terms]
            allowed_terms = [*allow_keywords, *concept_terms]
            for record in source_records:
                name = str(record.get("板块名称") or record.get("行业") or "").strip()
                if not name or not any(token.casefold() in name.casefold() for token in allowed_terms):
                    continue
                if any(token.casefold() in name.casefold() for token in exclude_keywords):
                    continue
                rank = _number(record.get("排名") or record.get("序号"), 999)
                change = _number(record.get("涨跌幅") or record.get("行业-涨跌幅"), 0)
                up_count = _number(record.get("上涨家数"), -1)
                company_count = _number(record.get("公司家数"), 0)
                gainers = up_count if up_count >= 0 else company_count
                leader = str(record.get("领涨股票") or record.get("领涨股") or "").strip()
                fund = _find_named_record(fund_by_name, name)
                fund_net = _number(fund.get("净额"), 0) if fund else 0
                fund_text = f"{fund_net:.2f}亿元" if fund else "AKShare资金流接口未返回"
                score = max(40, min(100, round(60 + change * 5 + min(gainers, 200) * 0.08 + max(-8, min(8, fund_net)) * 1.2)))
                rows.append({
                    "rank": len(rows) + 1,
                    "name": name,
                    "topic_type": "概念",
                    "primary_industry": _industry_for(name, concept_keywords),
                    "topic_tags": _topic_tags(name, concept_keywords),
                    "change_pct": f"{change:.2f}%",
                    "limit_up_count": f"上涨 {int(up_count)} 家" if up_count >= 0 else f"成分股 {int(company_count)} 家",
                    "net_inflow_100m": fund_text,
                    "score": score,
                    "catalyst": "AKShare 概念板块行情已采集，催化逻辑待结合财经新闻与行业研究补充。",
                    "leaders": [f"{leader}|板块领涨标的"] if leader else [],
                    "chain_notes": "行情源已接入；产业链和一级项目需结合 Mapping 数据进一步核对。",
                    "subtopics": _topic_tags(name, concept_keywords),
                })
            rows.sort(key=lambda item: (-int(item["score"]), item["name"]))
            for index, item in enumerate(rows[:20], start=1):
                item["rank"] = index
            rows = rows[:20]
            detail_meta = self._collect_company_details(ak, rows)
            return rows, {"status": "ok", "provider": "akshare", "endpoint": "stock_board_concept_name_em", "fund_flow_endpoint": "stock_fund_flow_concept", "raw_rows": int(len(source_records)), "matched_rows": len(rows), "board_rows": int(len(frame)) if frame is not None else 0, "fund_rows": len(fund_records), "fund_error": fund_error, "board_error": board_error, "detail": detail_meta}
        except Exception as exc:  # noqa: BLE001 - fall back to explicit demo status.
            return [], {"status": "error", "provider": "akshare", "endpoint": "stock_board_concept_name_em", "error": f"{type(exc).__name__}: {exc}"}

    def fetch_news(self, symbols: list[str] | None = None) -> tuple[list[dict[str, str]], dict[str, Any]]:
        if not self.enabled:
            return [], {"status": "disabled", "provider": "akshare"}
        try:
            import akshare as ak
            frame = ak.stock_news_main_cx()
            records = _news_records(frame, "AKShare财经内容精选", self.max_news)
            self.last_news_meta = {"status": "ok", "provider": "akshare", "endpoint": "stock_news_main_cx"}
            return records, self.last_news_meta
        except Exception as main_exc:
            records: list[dict[str, str]] = []
            errors = [f"stock_news_main_cx: {type(main_exc).__name__}: {main_exc}"]
            try:
                fallback_frame = ak.stock_info_global_em()
                fallback_records = _news_records(fallback_frame, "AKShare东方财富全球资讯", self.max_news)
                if fallback_records:
                    self.last_news_meta = {
                        "status": "ok",
                        "provider": "akshare",
                        "endpoint": "stock_info_global_em",
                        "fallback_from": "stock_news_main_cx",
                        "errors": errors,
                    }
                    return fallback_records, self.last_news_meta
            except Exception as fallback_exc:
                errors.append(f"stock_info_global_em: {type(fallback_exc).__name__}: {fallback_exc}")
            try:
                import akshare as ak
                for symbol in (symbols or [])[:3]:
                    code = _normalize_code(symbol)
                    if not code:
                        continue
                    try:
                        records.extend(_news_records(ak.stock_news_em(symbol=code), f"AKShare个股新闻:{code}", self.max_news))
                    except Exception as exc:
                        errors.append(f"stock_news_em({code}): {type(exc).__name__}: {exc}")
            except Exception as exc:
                errors.append(f"akshare import: {type(exc).__name__}: {exc}")
            self.last_news_meta = {"status": "partial" if records else "error", "provider": "akshare", "endpoints": ["stock_news_main_cx", "stock_news_em"], "errors": errors}
            return records[: self.max_news], self.last_news_meta

    def _collect_company_details(self, ak: Any, hotspots: list[dict[str, Any]]) -> dict[str, Any]:
            """Collect capped company data with Eastmoney-first and Sina fallbacks."""
            errors: list[str] = []
            spot_records: list[dict[str, Any]] = []
            quote_endpoint = ""
            try:
                spot_frame = ak.stock_zh_a_spot_em()
                spot_records = spot_frame.to_dict("records")
                quote_endpoint = "stock_zh_a_spot_em"
            except Exception as exc:
                errors.append(f"stock_zh_a_spot_em: {type(exc).__name__}: {exc}")
                try:
                    spot_frame = ak.stock_zh_a_spot()
                    spot_records = spot_frame.to_dict("records")
                    quote_endpoint = "stock_zh_a_spot"
                except Exception as fallback_exc:
                    errors.append(f"stock_zh_a_spot: {type(fallback_exc).__name__}: {fallback_exc}")
            spot_by_code = {_normalize_code(row.get("代码")): _clean_record(row) for row in spot_records if _normalize_code(row.get("代码"))}
            spot_by_name = {str(row.get("名称") or "").strip().casefold(): _clean_record(row) for row in spot_records if str(row.get("名称") or "").strip()}
            details: list[dict[str, Any]] = []
            detail_index: dict[str, dict[str, Any]] = {}
            daily_done: set[str] = set()

            def add_detail(candidate: dict[str, Any], board: str, leader_only: bool) -> None:
                code = _normalize_code(candidate.get("代码") or candidate.get("股票代码"))
                name = str(candidate.get("名称") or candidate.get("股票名称") or "").strip()
                if not name and code:
                    name = str(spot_by_code.get(code, {}).get("名称") or "").strip()
                if not code and name:
                    code = _normalize_code((spot_by_name.get(name.casefold()) or {}).get("代码"))
                if not code and not name:
                    return
                quote = dict(spot_by_code.get(code, {}) or spot_by_name.get(name.casefold(), {}) or {})
                if not quote and not leader_only:
                    quote = _clean_record(candidate)
                key = code or name.casefold()
                existing = detail_index.get(key)
                if existing:
                    if board not in existing["hotspots"]:
                        existing["hotspots"].append(board)
                        existing["hotspot"] = "、".join(existing["hotspots"])
                    return
                detail = {"code": code, "name": name, "hotspot": board, "hotspots": [board], "quote": quote, "data_status": "quote" if quote else "leader_only", "source": quote_endpoint or "AKShare概念资金流领涨股"}
                detail_index[key] = detail
                details.append(detail)
                if code and self.include_history and code not in daily_done:
                    daily_done.add(code)
                    prefix = "sh" if code.startswith("6") else "bj" if code.startswith(("4", "8", "9")) else "sz"
                    try:
                        daily = ak.stock_zh_a_daily(symbol=f"{prefix}{code}", start_date=(datetime.now() - timedelta(days=45)).strftime("%Y%m%d"), end_date=datetime.now().strftime("%Y%m%d"), adjust="")
                        latest = _frame_records(daily, limit=2)
                        if latest:
                            last = latest[-1]
                            shares = _number(last.get("outstanding_share"), 0)
                            price = _number(detail["quote"].get("最新价") or last.get("close"), 0)
                            if shares > 0 and price > 0:
                                detail["quote"]["流通股本"] = shares
                                detail["quote"]["流通市值(估算)"] = price * shares
                                detail["quote"].setdefault("日线日期", last.get("date", ""))
                    except Exception as exc:
                        errors.append(f"stock_zh_a_daily({code}): {type(exc).__name__}: {exc}")
                if leader_only or not code:
                    return
                prefix = "SH" if code.startswith("6") else "SZ" if code.startswith(("0", "3")) else "BJ"
                market_symbol = prefix + code
                for endpoint, call in (("profile", lambda: ak.stock_individual_info_em(symbol=code)), ("financial_indicators", lambda: ak.stock_financial_analysis_indicator(symbol=code, start_year=str(datetime.now().year - 2))), ("business_composition", lambda: ak.stock_zygc_em(symbol=market_symbol))):
                    try:
                        detail[endpoint] = _frame_records(call(), limit=8)
                    except Exception as exc:
                        detail[endpoint] = []
                        errors.append(f"{endpoint}({code}): {type(exc).__name__}: {exc}")
                if self.include_statements:
                    for statement_name, statement_call in (("balance_sheet", lambda: ak.stock_balance_sheet_by_report_em(symbol=market_symbol)), ("profit_sheet", lambda: ak.stock_profit_sheet_by_report_em(symbol=market_symbol)), ("cash_flow_sheet", lambda: ak.stock_cash_flow_sheet_by_report_em(symbol=market_symbol))):
                        try:
                            detail[statement_name] = _frame_records(statement_call(), limit=8)
                        except Exception as exc:
                            detail[statement_name] = []
                            errors.append(f"{statement_name}({code}): {type(exc).__name__}: {exc}")

            for hotspot in hotspots:
                if len(details) >= self.max_companies:
                    break
                board = str(hotspot.get("name") or "")
                candidates: list[dict[str, Any]] = []
                try:
                    candidates = _frame_records(ak.stock_board_concept_cons_em(symbol=board), limit=3)
                except Exception as exc:
                    errors.append(f"stock_board_concept_cons_em({board}): {type(exc).__name__}: {exc}")
                if candidates:
                    for candidate in candidates:
                        add_detail(candidate, board, False)
                        if len(details) >= self.max_companies:
                            break
                else:
                    for leader in hotspot.get("leaders", []):
                        leader_text = str(leader).split("|", 1)[0].strip()
                        match = re.search(r"(.+?)[（(](\d{6})[）)]", leader_text)
                        add_detail({"名称": match.group(1).strip() if match else leader_text, "代码": match.group(2) if match else ""}, board, True)
                        if len(details) >= self.max_companies:
                            break
            self.secondary_data = details[: self.max_companies]
            return {"companies": len(self.secondary_data), "errors": errors[:30], "quote_rows": len(spot_records), "quote_endpoint": quote_endpoint}
def _frame_records(frame: Any, limit: int = 20) -> list[dict[str, Any]]:
    if frame is None or not hasattr(frame, "to_dict"):
        return []
    return [_clean_record(row) for row in frame.to_dict("records")[:limit]]


def _news_records(frame: Any, source: str, limit: int) -> list[dict[str, str]]:
    records = []
    for item in _frame_records(frame, limit):
        records.append({
            "title": str(item.get("新闻标题") or item.get("标题") or item.get("summary") or "").strip(),
            "published_at": str(item.get("发布时间") or item.get("时间") or "").strip(),
            "url": str(item.get("新闻链接") or item.get("链接") or item.get("url") or "").strip(),
            "source": source,
        })
    return records


def _clean_record(record: dict[str, Any]) -> dict[str, Any]:
    cleaned: dict[str, Any] = {}
    for key, value in record.items():
        if value is None:
            cleaned[str(key)] = ""
        elif hasattr(value, "item"):
            cleaned[str(key)] = value.item()
        elif isinstance(value, (date, datetime)):
            cleaned[str(key)] = value.isoformat()
        else:
            cleaned[str(key)] = str(value) if value.__class__.__module__.startswith("pandas") else value
    return cleaned


def _normalize_code(value: Any) -> str:
    text = str(value or "").strip().upper().replace("SH", "").replace("SZ", "").replace("BJ", "")
    digits = "".join(char for char in text if char.isdigit())
    return digits.zfill(6) if digits else ""


def _find_named_record(records: dict[str, dict[str, Any]], name: str) -> dict[str, Any]:
    key = str(name or "").strip().casefold()
    if not key:
        return {}
    if key in records:
        return records[key]
    candidates = [value for record_name, value in records.items() if key in record_name or record_name in key]
    return candidates[0] if len(candidates) == 1 else {}

def _number(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _topic_tags(name: str, concept_keywords: dict[str, list[str]] | None = None) -> list[str]:
    tags = [str(term) for terms in (concept_keywords or {}).values() for term in terms if str(term) and str(term) in name]
    return list(dict.fromkeys(tags))[:5]


def _industry_for(name: str, concept_keywords: dict[str, list[str]] | None = None) -> str:
    for industry, terms in (concept_keywords or {}).items():
        if any(str(term) in name for term in terms):
            return industry
    if any(token in name for token in ("AI", "AIGC", "芯片", "封装", "算力", "存储", "半导体", "光模块")):
        return "TMT/半导体"
    if any(token in name for token in ("电池", "储能", "新能源", "光伏")):
        return "新能源"
    if any(token in name for token in ("机器人", "制造", "低空", "汽车")):
        return "高端制造"
    if any(token in name for token in ("材料", "散热", "陶瓷", "玻璃", "金刚石")):
        return "新材料"
    return "硬科技"