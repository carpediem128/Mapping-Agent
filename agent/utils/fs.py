from __future__ import annotations

from datetime import datetime
from pathlib import Path


def create_run_dir(root: Path, date: str) -> Path:
    run_id = datetime.now().strftime("%H%M%S")
    run_dir = root / "runs" / f"{date}_{run_id}"
    for child in ("reports", "mappings", "logs", "intermediate"):
        (run_dir / child).mkdir(parents=True, exist_ok=True)
    return run_dir

