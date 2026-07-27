from __future__ import annotations

import re


def safe_filename(value: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', "_", value.strip())
    cleaned = re.sub(r"\s+", "", cleaned)
    return cleaned or "未命名"


def contains_any(text: str, keywords: list[str]) -> bool:
    hay = (text or "").lower()
    return any(k.lower() in hay for k in keywords)


def dedupe_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        cleaned = str(value or "").strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            out.append(cleaned)
    return out

