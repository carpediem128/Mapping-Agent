from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from agent.json_utils import dumps_json
from agent.settings import ROOT, load_config
from agent.sources.akshare import AKShareClient
from agent.web_export import _build_industry_stats


def _number(value: Any, default: float = 0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _code(value: Any) -> str:
    text = str(value or "").upper()
    digits = "".join(char for char in text if char.isdigit())
    return digits.zfill(6) if digits else ""


def _leader_text(row: dict[str, Any]) -> str:
    name = str(row.get("名称") or row.get("股票名称") or "").strip()
    code = _code(row.get("代码") or row.get("股票代码"))
    if not name:
        return ""
    return f"{name}（{code}）|板块领涨标的" if code else f"{name}|板块领涨标的"


def enrich_leaders(ak: Any, hotspots: list[dict[str, Any]], errors: list[str]) -> None:
    for hotspot in hotspots:
        board = str(hotspot.get("name") or "").strip()
        if not board:
            continue
        try:
            frame = ak.stock_board_concept_cons_em(symbol=board)
            records = frame.to_dict("records") if hasattr(frame, "to_dict") else []
            change_keys = ("涨跌幅", "涨跌幅(%)", "涨跌")
            records.sort(key=lambda row: max((_number(row.get(key), -999) for key in change_keys), default=-999), reverse=True)
            leaders = [_leader_text(row) for row in records[:3]]
            leaders = [item for item in leaders if item]
            if leaders:
                hotspot["leaders"] = leaders
        except Exception as exc:  # noqa: BLE001
            errors.append(f"leaders({board}): {type(exc).__name__}: {exc}")


def enrich_financials(ak: Any, secondary_data: list[dict[str, Any]], errors: list[str]) -> dict[str, Any]:
    enriched = 0
    endpoint = "stock_financial_abstract_ths"
    for item in secondary_data:
        code = _code(item.get("code"))
        if not code:
            continue
        try:
            frame = ak.stock_financial_abstract_ths(symbol=code)
            records = frame.to_dict("records") if hasattr(frame, "to_dict") else []
            if not records:
                continue
            latest = records[0]
            item["financial_indicators"] = [{
                "报告期": latest.get("报告期", ""),
                "营业收入": latest.get("营业总收入", ""),
                "净利润": latest.get("净利润", ""),
                "毛利率": latest.get("销售毛利率", ""),
                "净利率": latest.get("销售净利率", ""),
                "净资产收益率": latest.get("净资产收益率", ""),
            }]
            item["financial_abstract"] = records[:4]
            item["financial_source"] = endpoint
            item["financial_status"] = "ok"
            enriched += 1
        except Exception as exc:  # noqa: BLE001
            item["financial_status"] = "error"
            errors.append(f"financial({code}): {type(exc).__name__}: {exc}")
    return {"endpoint": endpoint, "enriched_companies": enriched, "attempted_companies": len(secondary_data)}


def main() -> None:
    config = load_config()
    client = AKShareClient.from_config(config)
    rows, market_meta = client.fetch_hotspots(
        config.get("hardtech_allow_keywords", []),
        config.get("exclude_keywords", []),
        config.get("concept_keywords", {}),
    )
    errors: list[str] = []
    try:
        import akshare as ak
        enrich_leaders(ak, rows, errors)
        financial_meta = enrich_financials(ak, client.secondary_data, errors)
    except Exception as exc:  # noqa: BLE001
        financial_meta = {"endpoint": "stock_financial_abstract_ths", "enriched_companies": 0, "attempted_companies": len(client.secondary_data)}
        errors.append(f"akshare_enrichment: {type(exc).__name__}: {exc}")
    symbols = [str(item.get("code") or "") for item in client.secondary_data]
    news, news_meta = client.fetch_news(symbols=symbols)
    date = datetime.now().strftime("%Y%m%d")
    top20 = rows[:20]
    detail = market_meta.setdefault("detail", {})
    detail["financial"] = financial_meta
    detail["leader_count"] = 3
    detail["enrichment_errors"] = errors[:30]
    hotspots = {
        "date": date,
        "market_summary": f"AKShare 实时行情已采集：原始 {market_meta.get('raw_rows', 0)} 个，硬科技匹配 {len(top20)} 个；每个赛道展示前三领涨标的。",
        "data_status": "akshare_ok" if rows else "error",
        "market_source": market_meta,
        "news_source": news_meta,
        "secondary_companies": len(client.secondary_data),
        "news": news,
        "secondary_data": client.secondary_data,
        "top20": top20,
        "top10": top20[:10],
    }
    data_path = ROOT / "web" / "data" / "site_data.json"
    data = json.loads(data_path.read_text(encoding="utf-8"))
    if not rows and (data.get('hotspots') or {}).get('top20'):
        data['market_refresh_error'] = {'at': datetime.now().isoformat(timespec='seconds'), 'message': '行情接口未返回数据，保留上次快照', 'detail': errors[:10]}
        serialized = dumps_json(data, ensure_ascii=False, indent=2)
        data_path.write_text(serialized, encoding='utf-8')
        (ROOT / 'web' / 'data' / 'site_data.js').write_text('window.__MAPPING_SITE_DATA__ = ' + serialized + '\n', encoding='utf-8')
        return
    data["generated_at"] = datetime.now().isoformat(timespec="seconds")
    data["hotspots"] = hotspots
    data["industry_stats"] = _build_industry_stats({"top20": top20}, data.get("mappings", []))
    stats = data.setdefault("stats", {})
    stats["hotspot_count"] = len(top20)
    stats["industry_count"] = len(data["industry_stats"])
    serialized = dumps_json(data, ensure_ascii=False, indent=2)
    data_path.write_text(serialized, encoding="utf-8")
    (ROOT / "web" / "data" / "site_data.js").write_text("window.__MAPPING_SITE_DATA__ = " + serialized + "\n", encoding="utf-8")
    print(json.dumps({
        "data_status": hotspots["data_status"],
        "matched_rows": len(top20),
        "secondary_companies": len(client.secondary_data),
        "financial": financial_meta,
        "leader_count": 3,
        "enrichment_errors": errors[:10],
    }, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
