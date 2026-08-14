from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from agent.json_utils import dumps_json
from agent.settings import ROOT, load_config
from agent.sources.akshare import AKShareClient
from agent.web_export import _build_industry_stats


def main() -> None:
    config = load_config()
    client = AKShareClient.from_config(config)
    rows, market_meta = client.fetch_hotspots(
        config.get("hardtech_allow_keywords", []),
        config.get("exclude_keywords", []),
        config.get("concept_keywords", {}),
    )
    symbols = [str(item.get("code") or "") for item in client.secondary_data]
    news, news_meta = client.fetch_news(symbols=symbols)
    date = datetime.now().strftime("%Y%m%d")
    top20 = rows[:20]
    hotspots = {
        "date": date,
        "market_summary": (
            f"AKShare 实时行情已采集：原始 {market_meta.get('raw_rows', 0)} 个，"
            f"硬科技匹配 {len(top20)} 个；资金流来源：{market_meta.get('fund_flow_endpoint', '未返回')}。"
            if rows
            else "AKShare 实时行情未返回可用结果，请查看 market_source 错误信息。"
        ),
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
    data["generated_at"] = datetime.now().isoformat(timespec="seconds")
    data["hotspots"] = hotspots
    data["industry_stats"] = _build_industry_stats(
        {"top20": top20},
        data.get("mappings", []),
    )
    stats = data.setdefault("stats", {})
    stats["hotspot_count"] = len(top20)
    stats["industry_count"] = len(data["industry_stats"])
    serialized = dumps_json(data, ensure_ascii=False, indent=2)
    data_path.write_text(serialized, encoding="utf-8")
    (ROOT / "web" / "data" / "site_data.js").write_text(
        "window.__MAPPING_SITE_DATA__ = " + serialized + "\n",
        encoding="utf-8",
    )

    run_dirs = sorted((ROOT / "runs").glob("*"), key=lambda path: path.stat().st_mtime, reverse=True)
    if run_dirs:
        report_dir = run_dirs[0] / "reports"
        report_dir.mkdir(parents=True, exist_ok=True)
        (report_dir / f"{date}-二级市场热点列表.json").write_text(
            dumps_json(hotspots, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    print(json.dumps({
        "data_status": hotspots["data_status"],
        "matched_rows": len(top20),
        "market_source": market_meta,
        "secondary_companies": len(client.secondary_data),
        "news_count": len(news),
        "news_source": news_meta,
    }, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()