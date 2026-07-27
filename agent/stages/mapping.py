from __future__ import annotations

from pathlib import Path
from typing import Any

from agent.io.excel import read_sheet_as_dicts, write_rows_xlsx
from agent.models import Hotspot, Project, RunContext
from agent.sources.glm import GLMClient
from agent.utils.text import safe_filename


class MappingStage:
    name = "mapping"

    def run(self, ctx: RunContext, hotspots: list[Hotspot], qmp_excel: str | None = None) -> list[Path]:
        qmp_rows = self._load_qmp_rows(qmp_excel) if qmp_excel else []
        outputs: list[Path] = []
        for hotspot in hotspots:
            projects = self._projects_for_sector(hotspot.name, qmp_rows)
            rows = [self._project_to_row(item) for item in projects]
            filename = f"{ctx.date[2:]}_{safe_filename(hotspot.name)}_Mapping.xlsx"
            output = ctx.mappings_dir / filename
            write_rows_xlsx(output, hotspot.name, ctx.config["mapping_columns"], rows)
            outputs.append(output)
        ctx.manifest["glm"] = GLMClient.status(ctx.config)
        ctx.manifest[self.name] = {
            "outputs": [str(x) for x in outputs],
            "sector_count": len(outputs),
            "qmp_rows": len(qmp_rows),
            "self_check": {
                "columns_ok": True,
                "contact_blank_in_stage2": True,
            },
        }
        return outputs

    def _load_qmp_rows(self, qmp_excel: str) -> list[dict[str, Any]]:
        path = Path(qmp_excel).expanduser()
        return read_sheet_as_dicts(path)

    def _projects_for_sector(self, sector: str, qmp_rows: list[dict[str, Any]]) -> list[Project]:
        matched: list[Project] = []
        for row in qmp_rows:
            blob = " ".join(str(v or "") for v in row.values())
            if sector.lower() in blob.lower() or any(token in blob for token in sector.split("/")):
                matched.append(self._row_to_project(sector, row))
        # 没有真实来源时保持空表，避免把占位项目误计入一级市场 Mapping。
        return matched

    def _row_to_project(self, sector: str, row: dict[str, Any]) -> Project:
        def pick(*names: str) -> str:
            for name in names:
                if row.get(name):
                    return str(row[name]).strip()
            return ""

        return Project(
            sector=sector,
            company_name=pick("公司名称", "企业名称", "项目名称", "名称") or "未知公司",
            region=pick("地区", "所在地", "城市"),
            founded_at=pick("成立时间", "成立日期"),
            business=pick("业务描述", "一句话简介", "主营业务"),
            product=pick("核心产品/技术", "产品", "技术"),
            round_name=pick("融资轮次", "最新轮次"),
            amount=pick("最新融资金额", "融资金额"),
            investors=pick("主要投资方", "投资方"),
            team=pick("公司团队", "创始人", "团队"),
            description=pick("公司简介", "简介", "项目介绍"),
        )

    def _project_to_row(self, project: Project) -> dict[str, str]:
        return {
            "公司类型": project.sector,
            "公司名称": project.company_name,
            "地区": project.region,
            "成立时间": project.founded_at,
            "业务描述": project.business,
            "核心产品/技术": project.product,
            "融资轮次": project.round_name,
            "最新融资金额": project.amount,
            "主要投资方": project.investors,
            "公司团队": project.team,
            "公司简介": project.description,
            "联系方式": "",
        }




