from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "web" / "data"


def main() -> None:
    source_path = DATA_DIR / "mapping_sources.json"
    source = json.loads(source_path.read_text(encoding="utf-8"))
    bad_files = {item.get("source_file") for item in source.get("sources", []) if "\ufffd" in str(item.get("source_file") or "") or "\ufffd" in str(item.get("source_label") or "")}
    source["sources"] = [item for item in source.get("sources", []) if item.get("source_file") not in bad_files]
    source["records"] = [item for item in source.get("records", []) if item.get("source_file") not in bad_files]
    source["generated_at"] = datetime.now().isoformat(timespec="seconds")
    source["source_count"] = len({item.get("source_file") for item in source["sources"]})
    source["sheet_count"] = len(source["sources"])
    source["record_count"] = len(source["records"])
    source_path.write_text(json.dumps(source, ensure_ascii=False, indent=2), encoding="utf-8")

    site_path = DATA_DIR / "site_data.json"
    site = json.loads(site_path.read_text(encoding="utf-8"))
    site["mappings"] = [item for item in site.get("mappings", []) if "\ufffd" not in str(item.get("name") or "")]
    site["generated_at"] = datetime.now().isoformat(timespec="seconds")
    site.setdefault("stats", {})["mapping_count"] = len(site["mappings"])
    site["stats"]["mapping_rows"] = sum(int(item.get("row_count") or 0) for item in site["mappings"])
    site["reference_workbooks"] = {"source_count": source["source_count"], "sheet_count": source["sheet_count"], "record_count": source["record_count"], "sources": source["sources"]}
    serialized = json.dumps(site, ensure_ascii=False, indent=2)
    site_path.write_text(serialized, encoding="utf-8")
    (DATA_DIR / "site_data.js").write_text("window.__MAPPING_SITE_DATA__ = " + serialized + "\n", encoding="utf-8")

    db_path = DATA_DIR / "mapping.db"
    db = sqlite3.connect(db_path)
    bad_ids = [row[0] for row in db.execute("SELECT id FROM mapping_workbooks WHERE source_file LIKE '%�%' OR source_label LIKE '%�%'").fetchall()]
    if bad_ids:
        placeholders = ",".join("?" for _ in bad_ids)
        db.execute(f"DELETE FROM mapping_records WHERE workbook_id IN ({placeholders})", bad_ids)
        db.execute(f"DELETE FROM mapping_workbooks WHERE id IN ({placeholders})", bad_ids)
    db.execute("UPDATE mapping_workbooks SET sheet_count=(SELECT COUNT(DISTINCT sheet_name) FROM mapping_records WHERE workbook_id=mapping_workbooks.id), record_count=(SELECT COUNT(*) FROM mapping_records WHERE workbook_id=mapping_workbooks.id)")
    db.commit()
    result = {"removed_workbooks": len(bad_ids), "source_records": source["record_count"], "mapping_rows": site["stats"]["mapping_rows"], "db_records": db.execute("SELECT COUNT(*) FROM mapping_records").fetchone()[0]}
    db.close()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
