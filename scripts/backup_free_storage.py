from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "web" / "data"
BACKUP_DIR = ROOT / "data" / "free_storage_backups"


def main() -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    db_source = DATA_DIR / "mapping.db"
    json_source = DATA_DIR / "mapping_sources.json"
    site_source = DATA_DIR / "site_data.json"
    copied = []
    for source in (db_source, json_source, site_source):
        if source.exists():
            target = BACKUP_DIR / f"{source.stem}_{stamp}{source.suffix}"
            shutil.copy2(source, target)
            copied.append(str(target))
    manifest = {"created_at": datetime.now().isoformat(timespec="seconds"), "format": ["SQLite", "JSON"], "files": copied, "note": "Free local storage snapshot; keep private because contact data may be sensitive."}
    (BACKUP_DIR / f"manifest_{stamp}.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
