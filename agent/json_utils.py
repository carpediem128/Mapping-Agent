from __future__ import annotations

import json
import math
from typing import Any


def sanitize_json(value: Any) -> Any:
    """Return a copy containing only values accepted by strict JSON parsers."""
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {key: sanitize_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [sanitize_json(item) for item in value]
    return value


def dumps_json(value: Any, **kwargs: Any) -> str:
    return json.dumps(sanitize_json(value), allow_nan=False, **kwargs)