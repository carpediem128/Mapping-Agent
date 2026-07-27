from __future__ import annotations

import os
import sqlite3

from agent.mapping_db_pg import DB_PATH, _ensure_schema


def main() -> None:
    url = (os.getenv("MAPPING_DATABASE_URL") or os.getenv("DATABASE_URL") or "").strip()
    if not url.startswith(("postgres://", "postgresql://")):
        raise SystemExit("请先设置 MAPPING_DATABASE_URL 或 DATABASE_URL 为 PostgreSQL 连接串。")
    try:
        import psycopg
    except ImportError as exc:
        raise SystemExit("缺少 psycopg，请执行 python -m pip install -r hardtech_investment_agent\\requirements-postgres.txt") from exc
    if not DB_PATH.exists():
        raise SystemExit(f"找不到本地 SQLite：{DB_PATH}")
    sqlite = sqlite3.connect(DB_PATH)
    sqlite.row_factory = sqlite3.Row
    postgres = psycopg.connect(url)
    _ensure_schema(postgres, "postgres")
    workbook_ids = {}
    for row in sqlite.execute("SELECT source_key, source_file, source_label, workflow_status, uploaded_at, updated_at, sheet_count, record_count FROM mapping_workbooks"):
        postgres.execute("""
        INSERT INTO mapping_workbooks(source_key, source_file, source_label, workflow_status, uploaded_at, updated_at, sheet_count, record_count)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT(source_key) DO UPDATE SET source_file=excluded.source_file, source_label=excluded.source_label,
          workflow_status=excluded.workflow_status, updated_at=excluded.updated_at, sheet_count=excluded.sheet_count, record_count=excluded.record_count
        """, tuple(row))
        workbook_ids[row["source_key"]] = postgres.execute("SELECT id FROM mapping_workbooks WHERE source_key=%s", (row["source_key"],)).fetchone()[0]
    for row in sqlite.execute("SELECT mapping_records.id, mapping_workbooks.source_key, mapping_records.source_file, mapping_records.sheet_name, mapping_records.market_level, mapping_records.row_number, mapping_records.topic, mapping_records.company_name, mapping_records.fields_json, mapping_records.search_text, mapping_records.quality_flags_json FROM mapping_records JOIN mapping_workbooks ON mapping_workbooks.id=mapping_records.workbook_id"):
        postgres.execute("""
        INSERT INTO mapping_records(id, workbook_id, source_file, sheet_name, market_level, row_number, topic, company_name, fields_json, search_text, quality_flags_json)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT(id) DO UPDATE SET workbook_id=excluded.workbook_id, fields_json=excluded.fields_json,
          search_text=excluded.search_text, quality_flags_json=excluded.quality_flags_json
        """, (row["id"], workbook_ids[row["source_key"]], row["source_file"], row["sheet_name"], row["market_level"], row["row_number"], row["topic"], row["company_name"], row["fields_json"], row["search_text"], row["quality_flags_json"]))
    postgres.commit()
    result = {"backend": "postgres", "workbooks": postgres.execute("SELECT COUNT(*) FROM mapping_workbooks").fetchone()[0], "records": postgres.execute("SELECT COUNT(*) FROM mapping_records").fetchone()[0]}
    postgres.close()
    sqlite.close()
    print(result)


if __name__ == "__main__":
    main()
