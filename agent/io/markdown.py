from __future__ import annotations

from pathlib import Path

from agent.models import Hotspot


def write_hotspot_markdown(path: Path, date: str, hotspots: list[Hotspot], market_summary: str) -> None:
    lines: list[str] = []
    lines.append(f"# {date} 二级市场热点列表")
    lines.append("")
    lines.append(f"大盘概况：{market_summary}")
    lines.append("")
    lines.append("## Top20 热点概念/板块")
    lines.append("")
    lines.append("|排名|概念/板块名称|所属一级行业|板块涨跌幅|涨停家数|主力资金净流入|热度评分|催化事件|")
    lines.append("|---:|---|---|---:|---:|---:|---:|---|")
    for item in hotspots[:20]:
        lines.append(
            f"|{item.rank}|{item.name}|{item.primary_industry}|{item.change_pct}|{item.limit_up_count}|"
            f"{item.net_inflow_100m}|{item.score}|{item.catalyst}|"
        )
    lines.append("")
    lines.append("## Top10 热点详细展开")
    for item in hotspots[:10]:
        lines.append("")
        lines.append(f"### {item.name} - 热度评分 {item.score}")
        lines.append(f"- 核心催化逻辑：{item.catalyst or '待行情/新闻源补充'}")
        lines.append(f"- 龙头股列表：{'; '.join(item.leaders) if item.leaders else '待行情源补充'}")
        lines.append(f"- 产业链核心环节：{item.chain_notes or '待产业链模块补充'}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")

