from __future__ import annotations

import threading
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import web_server_daily
import web_server_product_fast as base
from agent.settings import ROOT


class CleanProductHandler(base.ProductFastDashboardHandler):
    server_version = "HardtechMappingServer/1.2-clean"

    def do_GET(self) -> None:
        if urlparse(self.path).path == "/":
            html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
            marker = '<script src="./app.js?v=20260715"></script>'
            injected = '<link rel="stylesheet" href="./mapping_ui_fix.css?v=20260727"><script src="./mapping_ui_fix.js?v=20260727"></script><script src="./mapping_ui_clean.js?v=20260727"></script><script src="./hotspot_freshness_live.js?v=20260727"></script>'
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
    threading.Thread(target=web_server_daily._refresh_when_stale, daemon=True).start()
    handler = partial(CleanProductHandler, directory=str(ROOT / "web"))
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
