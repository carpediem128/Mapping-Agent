from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from agent.settings import ROOT


DB_PATH = ROOT / "web" / "data" / "mapping.db"


def _url() -> str:
    return (os.getenv("MAPPING_DATABASE_URL") or os.getenv("DATABASE_URL") or "").strip()


def _using_postgres() -> bool:
    return _url().lower().startswith(("postgres://", "postgresql://"))


def _connect():
    if _using_postgres():
        try:
            import psycopg
        except ImportError as exc:
            raise RuntimeError("已设置 PostgreSQL 连接串，但未安装 psycopg。请执行 pip install -r requirements-postgres.txt") from exc
        return psycopg.connect(_url()), "postgres"
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.execute("PRAGMA journal_mode=WAL")
    return connection, "sqlite"


def _ensure_schema(connection, backend: str) -> None:
    identity = "BIGSERIAL PRIMARY KEY" if backend == "postgres" else "INTEGER PRIMARY KEY"
    connection.execute(f"""
    CREATE TABLE IF NOT EXISTS mapping_workbooks (
      id {identity}, source_key TEXT NOT NULL UNIQUE, source_file TEXT NOT NULL,
      source_label TEXT NOT NULL, workflow_status TEXT NOT NULL, uploaded_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, sheet_count INTEGER NOT NULL DEFAULT 0, record_count INTEGER NOT NULL DEFAULT 0
    )
    """)
    connection.execute("""
    CREATE TABLE IF NOT EXISTS mapping_records (
      id TEXT PRIMARY KEY, workbook_id BIGINT NOT NULL, source_file TEXT NOT NULL,
      sheet_name TEXT NOT NULL, market_level TEXT NOT NULL, row_number INTEGER NOT NULL,
      topic TEXT, company_name TEXT, fields_json TEXT NOT NULL, search_text TEXT NOT NULL,
      quality_flags_json TEXT NOT NULL DEFAULT '[]'
    )
    """)
    connection.execute("CREATE INDEX IF NOT EXISTS idx_mapping_company ON mapping_records(company_name)")
    connection.execute("CREATE INDEX IF NOT EXISTS idx_mapping_topic ON mapping_records(topic)")
    connection.execute("CREATE INDEX IF NOT EXISTS idx_mapping_level ON mapping_records(market_level)")


def _execute(connection, backend: str, query: str, params=()):
    if backend == "postgres":
        query = query.replace("?", "%s")
    return connection.execute(query, params)


def register_exported_payload(payload: dict[str, Any], run_dir: Path) -> dict[str, Any]:
    connection, backend = _connect()
    _ensure_schema(connection, backend)
    now = datetime.now().isoformat(timespec="seconds")
    workbook_count = 0
    record_count = 0
    for mapping in payload.get("mappings", []):
        source_file = str(mapping.get("name") or "uploaded_mapping.xlsx")
        source_key = f"{run_dir.name}|{source_file}"
        source_label = str(mapping.get("sector") or source_file)
        _execute(connection, backend, """
        INSERT INTO mapping_workbooks(source_key, source_file, source_label, workflow_status, uploaded_at, updated_at, sheet_count, record_count)
        VALUES (?, ?, ?, 'mapping_completed', ?, ?, ?, ?)
        ON CONFLICT(source_key) DO UPDATE SET updated_at=excluded.updated_at, workflow_status='mapping_completed', record_count=excluded.record_count
        """, (source_key, source_file, source_label, now, now, len(mapping.get("sheets", [])), int(mapping.get("row_count") or 0)))
        workbook_id = _execute(connection, backend, "SELECT id FROM mapping_workbooks WHERE source_key = ?", (source_key,)).fetchone()[0]
        for index, preview in enumerate(mapping.get("preview", []), start=1):
            company = str(preview.get("company") or "")
            fields_json = json.dumps(dict(preview), ensure_ascii=False)
            record_id = f"{source_key}|{index}|{company}"
            _execute(connection, backend, """
            INSERT INTO mapping_records(id, workbook_id, source_file, sheet_name, market_level, row_number, topic, company_name, fields_json, search_text, quality_flags_json)
            VALUES (?, ?, ?, ?, 'primary', ?, ?, ?, ?, ?, '[]')
            ON CONFLICT(id) DO UPDATE SET fields_json=excluded.fields_json, search_text=excluded.search_text
            """, (record_id, workbook_id, source_file, "一级市场", index, source_label, company, fields_json, " ".join(str(value) for value in preview.values())))
            record_count += 1
        workbook_count += 1
    connection.commit()
    connection.close()
    return {"backend": backend, "workbooks": workbook_count, "records": record_count}


def database_status() -> dict[str, Any]:
    configured_url = bool(_url())
    try:
        connection, backend = _connect()
        _ensure_schema(connection, backend)
        result = {
            "configured": True,
            "backend": backend,
            "path": _url() if backend == "postgres" else str(DB_PATH),
            "workbooks": _execute(connection, backend, "SELECT COUNT(*) FROM mapping_workbooks").fetchone()[0],
            "records": _execute(connection, backend, "SELECT COUNT(*) FROM mapping_records").fetchone()[0],
            "primary_records": _execute(connection, backend, "SELECT COUNT(*) FROM mapping_records WHERE market_level = ?", ("primary",)).fetchone()[0],
            "secondary_records": _execute(connection, backend, "SELECT COUNT(*) FROM mapping_records WHERE market_level = ?", ("secondary",)).fetchone()[0],
        }
        connection.close()
        return result
    except Exception as exc:  # noqa: BLE001
        return {"configured": False, "backend": "postgres" if configured_url else "sqlite", "path": _url() if configured_url else str(DB_PATH), "error": f"{type(exc).__name__}: {exc}"}
