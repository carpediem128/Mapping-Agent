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
    connection = sqlite3.connect(DB_PATH)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS mapping_workbooks (
            id INTEGER PRIMARY KEY,
            source_id TEXT NOT NULL UNIQUE,
            source_file TEXT NOT NULL,
            source_label TEXT NOT NULL,
            workflow_status TEXT NOT NULL DEFAULT 'mapping_completed',
            uploaded_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sheet_count INTEGER NOT NULL DEFAULT 0,
            record_count INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS mapping_records (
            id TEXT PRIMARY KEY,
            workbook_id INTEGER NOT NULL REFERENCES mapping_workbooks(id),
            source_file TEXT NOT NULL,
            sheet_name TEXT NOT NULL,
            market_level TEXT NOT NULL,
            row_number INTEGER NOT NULL,
            topic TEXT,
            company_name TEXT,
            fields_json TEXT NOT NULL,
            search_text TEXT NOT NULL,
            quality_flags_json TEXT NOT NULL DEFAULT '[]'
        );
        CREATE INDEX IF NOT EXISTS idx_mapping_records_company ON mapping_records(company_name);
        CREATE INDEX IF NOT EXISTS idx_mapping_records_topic ON mapping_records(topic);
        CREATE INDEX IF NOT EXISTS idx_mapping_records_level ON mapping_records(market_level);
        """
    )
    source_to_id: dict[str, int] = {}
    for item in source.get("sources", []):
        cursor = connection.execute(
            """
            INSERT INTO mapping_workbooks(source_id, source_file, source_label, workflow_status, uploaded_at, updated_at, sheet_count, record_count)
            VALUES (?, ?, ?, 'mapping_completed', ?, ?, 1, ?)
            ON CONFLICT(source_id) DO UPDATE SET
                source_file=excluded.source_file,
                source_label=excluded.source_label,
                workflow_status='mapping_completed',
                updated_at=excluded.updated_at,
                record_count=excluded.record_count
            """,
            (item["source_id"], item["source_file"], item["source_label"], now, now, item.get("row_count", 0)),
        )
        row = connection.execute("SELECT id FROM mapping_workbooks WHERE source_id = ?", (item["source_id"],)).fetchone()
        source_to_id[item["source_id"]] = int(row[0])
    for record in source.get("records", []):
        workbook_id = source_to_id.get(record["source_id"])
        if workbook_id is None:
            continue
        connection.execute(
            """
            INSERT INTO mapping_records(id, workbook_id, source_file, sheet_name, market_level, row_number, topic, company_name, fields_json, search_text, quality_flags_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                workbook_id=excluded.workbook_id,
                fields_json=excluded.fields_json,
                search_text=excluded.search_text,
                quality_flags_json=excluded.quality_flags_json
            """,
            (
                record["id"],
                workbook_id,
                record["source_file"],
                record["sheet"],
                "secondary" if record["sheet"] == "二级市场" else "primary",
                record["row_number"],
                record.get("topic", ""),
                record.get("company", ""),
                json.dumps(record.get("fields", {}), ensure_ascii=False),
                record.get("search_text", ""),
                json.dumps(record.get("quality_flags", []), ensure_ascii=False),
            ),
        )
    for item in source.get("sources", []):
        connection.execute(
            "UPDATE mapping_workbooks SET sheet_count = (SELECT COUNT(DISTINCT sheet_name) FROM mapping_records WHERE workbook_id = id), record_count = (SELECT COUNT(*) FROM mapping_records WHERE workbook_id = id) WHERE source_id = ?",
            (item["source_id"],),
        )
    connection.commit()
    counts = connection.execute("SELECT COUNT(*) FROM mapping_records").fetchone()[0]
    workbooks = connection.execute("SELECT COUNT(*) FROM mapping_workbooks").fetchone()[0]
    connection.close()
    print(json.dumps({"database": str(DB_PATH), "workbooks": workbooks, "records": counts, "workflow_status": "mapping_completed"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
