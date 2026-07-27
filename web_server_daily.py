from __future__ import annotations

import json
import threading
from datetime import datetime, timedelta
from functools import partial
from http.server import ThreadingHTTPServer
from urllib.parse import urlparse

import web_server_final as base


def _expected_market_date() -> str:
    current = datetime.now()
    if current.weekday() == 5:
        current -= timedelta(days=1)
    elif current.weekday() == 6:
        current -= timedelta(days=2)
    return current.strftime("%Y%m%d")


def _refresh_when_stale() -> None:
    data_path = base.base.database_server.WEB_DIR / "data" / "site_data.json"
    try:
        data = json.loads(data_path.read_text(encoding="utf-8"))
        cached_date = str((data.get("hotspots") or {}).get("date") or "")
        expected = _expected_market_date()
        if cached_date >= expected and (data.get("hotspots") or {}).get("data_status") == "akshare_ok":
            print(f"Market data cache is current: {cached_date}")
            return
        print(f"Market data cache is stale: {cached_date or 'missing'}; refreshing toward {expected}")
        from scripts.refresh_market_data_enhanced import main as refresh_market_data

        refresh_market_data()
    except Exception as exc:  # noqa: BLE001
        print(f"Market data refresh skipped: {type(exc).__name__}: {exc}")


class DailyDashboardHandler(base.FinalDashboardHandler):
    server_version = "HardtechMappingServer/0.8-daily"

    def do_GET(self) -> None:
        if urlparse(self.path).path == "/":
            html = (base.base.database_server.WEB_DIR / "index.html").read_text(encoding="utf-8")
            marker = '<script src="./app.js?v=20260715"></script>'
            injected = '<link rel="stylesheet" href="./mapping_ui_fix.css?v=20260727"><script src="./mapping_ui_fix.js?v=20260727"></script><script src="./hotspot_freshness_live.js?v=20260727"></script>'
            html = html.replace(marker, marker + injected)
            body = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def run_server(port: int = 4173) -> None:
    threading.Thread(target=_refresh_when_stale, daemon=True).start()
    handler = partial(DailyDashboardHandler, directory=str(base.base.database_server.WEB_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"Hardtech Mapping dashboard: http://127.0.0.1:{port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    import os

    run_server(int(os.getenv("MAPPING_PORT", "4173")))
