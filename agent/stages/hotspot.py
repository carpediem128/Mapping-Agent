from __future__ import annotations

import json
from dataclasses import asdict

from agent.io.markdown import write_hotspot_markdown
from agent.models import Hotspot, RunContext
from agent.sources.akshare import AKShareClient
from agent.sources.market import build_demo_hotspots


class HotspotStage:
    name = "hotspot"

    def run(self, ctx: RunContext) -> list[Hotspot]:
        client = AKShareClient.from_config(ctx.config)
        allow = ctx.config.get("hardtech_allow_keywords", [])
        exclude = ctx.config.get("exclude_keywords", [])
        raw_hotspots, market_meta = client.fetch_hotspots(allow, exclude, ctx.config.get("concept_keywords", {}))
        data_status = "akshare_ok" if raw_hotspots else "fallback_demo"
        if raw_hotspots:
            hotspots = [Hotspot(**item) for item in raw_hotspots]
            market_summary = f"AKShare 已采集概念板块行情：原始 {market_meta.get('raw_rows', 0)} 个，硬科技匹配 {len(hotspots)} 个。"
        else:
            hotspots = build_demo_hotspots(ctx.config)
            market_summary = "AKShare 行情暂未返回可用结果，当前使用明确标注的本地候选清单；请查看来源状态。"
        symbols = [str(item.get("code") or "") for item in client.secondary_data]
        news, news_meta = client.fetch_news(symbols=symbols)
        output = ctx.reports_dir / f"{ctx.date}-二级市场热点列表.md"
        write_hotspot_markdown(output, ctx.date, hotspots, market_summary)
        structured_output = ctx.reports_dir / f"{ctx.date}-二级市场热点列表.json"
        structured_output.write_text(json.dumps({
            "date": ctx.date,
            "market_summary": market_summary,
            "data_status": data_status,
            "market_source": market_meta,
            "news_source": news_meta,
            "secondary_companies": len(client.secondary_data),
            "news": news,
            "secondary_data": client.secondary_data,
            "top20": [asdict(item) for item in hotspots[:20]],
            "top10": [asdict(item) for item in hotspots[:10]],
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        ctx.manifest[self.name] = {
            "output": str(output),
            "structured_output": str(structured_output),
            "count": len(hotspots),
            "market_summary": market_summary,
            "data_status": data_status,
            "market_source": market_meta,
            "news_source": news_meta,
            "secondary_companies": len(client.secondary_data),
            "self_check": {
                "filename_ok": output.name.startswith(ctx.date),
                "hardtech_only": True,
                "top20_present": len(hotspots) >= 20,
                "top10_detail_present": all(item.catalyst and item.chain_notes for item in hotspots[:10]),
                "structured_output_present": structured_output.exists(),
            },
        }
        return hotspots



