from __future__ import annotations

import time
from urllib.error import URLError
from urllib.request import Request, urlopen


def fetch_text(url: str, timeout: int = 15, delay: float = 0.2) -> str:
    time.sleep(delay)
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 HardtechInvestmentAgent/0.1"})
    try:
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read(2_000_000)
            charset = resp.headers.get_content_charset() or "utf-8"
            return raw.decode(charset, errors="replace")
    except URLError as exc:
        raise RuntimeError(f"fetch failed: {url}: {exc}") from exc

