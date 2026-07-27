from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config" / "default_config.json"


def load_config(path: str | None = None) -> dict[str, Any]:
    config_path = Path(path).expanduser() if path else DEFAULT_CONFIG
    with config_path.open("r", encoding="utf-8-sig") as fh:
        return json.load(fh)


def save_manifest(run_dir: Path, manifest: dict[str, Any]) -> None:
    run_dir.mkdir(parents=True, exist_ok=True)
    with (run_dir / "run_manifest.json").open("w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)


