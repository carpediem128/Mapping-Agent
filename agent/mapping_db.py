from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from agent.settings import ROOT


DB_PATH = ROOT / "web" / "data" / "mapping.db"


def _ensure_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
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
        """
    )


def register_exported_payload(payload: dict[str, Any], run_dir: Path) -> dict[str, int]:
    """Persist the structured Mapping summary produced by a completed upload run."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.execute("PRAGMA journal_mode=WAL")
    _ensure_schema(connection)
    now = datetime.now().isoformat(timespec="seconds")
    workbook_count = 0
    record_count = 0
    for mapping in payload.get("mappings", []):
        source_file = str(mapping.get("name") or "uploaded_mapping.xlsx")
        source_key = f"{run_dir.name}|{source_file}"
        source_label = str(mapping.get("sector") or source_file)
        connection.execute(
            """
            INSERT INTO mapping_workbooks(source_key, source_file, source_label, workflow_status, uploaded_at, updated_at, sheet_count, record_count)
            VALUES (?, ?, ?, 'mapping_completed', ?, ?, ?, ?)
            ON CONFLICT(source_key) DO UPDATE SET updated_at=excluded.updated_at, workflow_status='mapping_completed', record_count=excluded.record_count
            """,
            (source_key, source_file, source_label, now, now, len(mapping.get("sheets", [])), int(mapping.get("row_count") or 0)),
        )
        workbook_id = connection.execute("SELECT id FROM mapping_workbooks WHERE source_key = ?", (source_key,)).fetchone()[0]
        for index, preview in enumerate(mapping.get("preview", []), start=1):
            company = str(preview.get("company") or "")
            fields = dict(preview)
            record_id = f"{source_key}|{index}|{company}"
            connection.execute(
                """
                INSERT INTO mapping_records(id, workbook_id, source_file, sheet_name, market_level, row_number, topic, company_name, fields_json, search_text, quality_flags_json)
                VALUES (?, ?, ?, ?, 'primary', ?, ?, ?, ?, ?, '[]')
                ON CONFLICT(id) DO UPDATE SET fields_json=excluded.fields_json, search_text=excluded.search_text
                """,
                (record_id, workbook_id, source_file, "一级市场", index, source_label, company, json.dumps(fields, ensure_ascii=False), " ".join(str(value) for value in fields.values())),
            )
            record_count += 1
        workbook_count += 1
    connection.commit()
    connection.close()
    return {"workbooks": workbook_count, "records": record_count}


def database_status() -> dict[str, Any]:
    if not DB_PATH.exists():
        return {"configured": False, "path": str(DB_PATH), "workbooks": 0, "records": 0}
    connection = sqlite3.connect(DB_PATH)
    _ensure_schema(connection)
    result = {
        "configured": True,
        "path": str(DB_PATH),
        "workbooks": connection.execute("SELECT COUNT(*) FROM mapping_workbooks").fetchone()[0],
        "records": connection.execute("SELECT COUNT(*) FROM mapping_records").fetchone()[0],
        "primary_records": connection.execute("SELECT COUNT(*) FROM mapping_records WHERE market_level='primary'").fetchone()[0],
        "secondary_records": connection.execute("SELECT COUNT(*) FROM mapping_records WHERE market_level='secondary'").fetchone()[0],
    }
    connection.close()
    return result
