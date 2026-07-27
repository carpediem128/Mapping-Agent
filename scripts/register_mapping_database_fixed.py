from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "web" / "data"
SOURCE_PATH = DATA_DIR / "mapping_sources.json"
DB_PATH = DATA_DIR / "mapping.db"


def main() -> None:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    now = datetime.now().isoformat(timespec="seconds")
    db = sqlite3.connect(DB_PATH)
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript("""
    CREATE TABLE IF NOT EXISTS mapping_workbooks (
      id INTEGER PRIMARY KEY, source_key TEXT NOT NULL UNIQUE, source_file TEXT NOT NULL,
      source_label TEXT NOT NULL, workflow_status TEXT NOT NULL, uploaded_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, sheet_count INTEGER NOT NULL DEFAULT 0, record_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS mapping_records (
      id TEXT PRIMARY KEY, workbook_id INTEGER NOT NULL, source_file TEXT NOT NULL,
      sheet_name TEXT NOT NULL, market_level TEXT NOT NULL, row_number INTEGER NOT NULL,
      topic TEXT, company_name TEXT, fields_json TEXT NOT NULL, search_text TEXT NOT NULL,
      quality_flags_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_mapping_company ON mapping_records(company_name);
    CREATE INDEX IF NOT EXISTS idx_mapping_topic ON mapping_records(topic);
    CREATE INDEX IF NOT EXISTS idx_mapping_level ON mapping_records(market_level);
    """)
    workbook_ids = {}
    for item in source.get("sources", []):
        key = f"{item['source_file']}|{item['source_label']}"
        db.execute("""
        INSERT INTO mapping_workbooks(source_key, source_file, source_label, workflow_status, uploaded_at, updated_at)
        VALUES (?, ?, ?, 'mapping_completed', ?, ?)
        ON CONFLICT(source_key) DO UPDATE SET source_file=excluded.source_file, source_label=excluded.source_label,
          workflow_status='mapping_completed', updated_at=excluded.updated_at
        """, (key, item["source_file"], item["source_label"], now, now))
        workbook_ids[key] = db.execute("SELECT id FROM mapping_workbooks WHERE source_key = ?", (key,)).fetchone()[0]
    for record in source.get("records", []):
        key = f"{record['source_file']}|{record['source_label']}"
        workbook_id = workbook_ids[key]
        db.execute("""
        INSERT INTO mapping_records(id, workbook_id, source_file, sheet_name, market_level, row_number, topic, company_name, fields_json, search_text, quality_flags_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET fields_json=excluded.fields_json, search_text=excluded.search_text,
          quality_flags_json=excluded.quality_flags_json, workbook_id=excluded.workbook_id
        """, (record["id"], workbook_id, record["source_file"], record["sheet"],
              "secondary" if record["sheet"] == "二级市场" else "primary", record["row_number"],
              record.get("topic", ""), record.get("company", ""),
              json.dumps(record.get("fields", {}), ensure_ascii=False), record.get("search_text", ""),
              json.dumps(record.get("quality_flags", []), ensure_ascii=False)))
    db.execute("UPDATE mapping_workbooks SET sheet_count=(SELECT COUNT(DISTINCT sheet_name) FROM mapping_records WHERE workbook_id=mapping_workbooks.id), record_count=(SELECT COUNT(*) FROM mapping_records WHERE workbook_id=mapping_workbooks.id)")
    db.commit()
    result = {"database": str(DB_PATH), "workbooks": db.execute("SELECT COUNT(*) FROM mapping_workbooks").fetchone()[0], "records": db.execute("SELECT COUNT(*) FROM mapping_records").fetchone()[0], "primary_records": db.execute("SELECT COUNT(*) FROM mapping_records WHERE market_level='primary'").fetchone()[0], "secondary_records": db.execute("SELECT COUNT(*) FROM mapping_records WHERE market_level='secondary'").fetchone()[0], "workflow_status": "mapping_completed"}
    db.close()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
