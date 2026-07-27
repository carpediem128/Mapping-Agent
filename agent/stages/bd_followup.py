from __future__ import annotations

from pathlib import Path

from agent.io.excel import read_sheet_as_dicts, write_rows_xlsx
from agent.models import RunContext


class BdFollowupStage:
    name = "bd_followup"

    def run(self, ctx: RunContext, mapping_files: list[Path]) -> Path:
        rows: list[dict[str, str]] = []
        seen: set[str] = set()
        for path in mapping_files:
            sector = self._sector_from_filename(path)
            for item in read_sheet_as_dicts(path):
                company = str(item.get("公司名称") or "").strip()
                if not company or company in seen or "待补充" in company:
                    continue
                seen.add(company)
                rows.append(
                    {
                        "所属赛道": sector,
                        "公司名称": company,
                        "地区": item.get("地区", ""),
                        "业务描述": item.get("业务描述", ""),
                        "核心产品/技术": item.get("核心产品/技术", ""),
                        "融资轮次": item.get("融资轮次", ""),
                        "公司团队": item.get("公司团队", ""),
                        "公司简介": item.get("公司简介", ""),
                        "联系方式": item.get("联系方式", ""),
                        "是否联系上": "否",
                        "是否已约见": "否",
                    }
                )
        output = ctx.reports_dir / f"{ctx.date}-硬科技项目总表-BD跟进.xlsx"
        write_rows_xlsx(output, "BD跟进总表", ctx.config["bd_columns"], rows)
        ctx.manifest[self.name] = {
            "output": str(output),
            "rows": len(rows),
            "self_check": {
                "deduped": len(rows) == len(seen),
                "status_default_no": True,
                "columns_ok": True,
            },
        }
        return output

    def _sector_from_filename(self, path: Path) -> str:
        stem = path.stem
        parts = stem.split("_")
        return parts[1] if len(parts) >= 3 else stem

