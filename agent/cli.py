from __future__ import annotations

import argparse
import json
from pathlib import Path

from agent.models import RunContext
from agent.pipeline import InvestmentPipeline
from agent.settings import ROOT, load_config
from agent.utils.fs import create_run_dir
from agent.web_export import export_run_to_web


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Hardtech investment workflow agent")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="Run PRD workflow stages 1-4")
    run.add_argument("--date", required=True, help="YYYYMMDD")
    run.add_argument("--qmp-excel", help="Qimingpian export Excel")
    run.add_argument("--config", help="JSON config path")
    run.add_argument("--offline-demo", action="store_true", help="Generate structured demo outputs without live market data")

    contacts = sub.add_parser("contacts", help="Only run contact enrichment for mapping files")
    contacts.add_argument("--date", required=True, help="YYYYMMDD")
    contacts.add_argument("--mapping-dir", required=True)
    contacts.add_argument("--config", help="JSON config path")

    merge = sub.add_parser("merge", help="Only merge mapping files into BD follow-up workbook")
    merge.add_argument("--date", required=True, help="YYYYMMDD")
    merge.add_argument("--mapping-dir", required=True)
    merge.add_argument("--config", help="JSON config path")

    export_web = sub.add_parser("export-web", help="Export a run directory to the static web dashboard")
    export_web.add_argument("--run-dir", required=True)
    export_web.add_argument("--web-dir", default=str(ROOT / "web"))
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if args.command == "export-web":
        payload = export_run_to_web(Path(args.run_dir), Path(args.web_dir))
        print(json.dumps({"web_dir": args.web_dir, "stats": payload["stats"]}, ensure_ascii=False, indent=2))
        return 0

    config = load_config(args.config)
    run_dir = create_run_dir(ROOT, args.date)
    ctx = RunContext(date=args.date, run_dir=run_dir, config=config, offline_demo=getattr(args, "offline_demo", False))
    pipeline = InvestmentPipeline()

    if args.command == "run":
        manifest = pipeline.run_all(ctx, qmp_excel=args.qmp_excel)
    elif args.command == "contacts":
        manifest = pipeline.run_contacts(ctx, Path(args.mapping_dir))
    elif args.command == "merge":
        manifest = pipeline.run_merge(ctx, Path(args.mapping_dir))
    else:
        raise ValueError(args.command)

    print(json.dumps({"run_dir": str(run_dir), "manifest": manifest}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
