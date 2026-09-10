from __future__ import annotations

import os
import threading
from functools import partial
from http.server import ThreadingHTTPServer
from urllib.parse import urlparse

from server import web_server_daily
from server import web_server_product_fast as base
from agent.settings import ROOT
from server.research_routes import ResearchRoutes


class V1DashboardHandler(ResearchRoutes, base.ProductFastDashboardHandler):
    server_version = "HardtechMappingServer/1.0"

    def do_GET(self) -> None:
        if urlparse(self.path).path == "/":
            html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
            marker = '<script src="./app.js?v=20260715"></script>'
            injected = ('<link rel="stylesheet" href="./mapping_ui_fix.css?v=v1"><link rel="stylesheet" href="./mapping_split.css?v=v1"><link rel="stylesheet" href="./mapping_progress.css?v=v1"><link rel="stylesheet" href="./contact_v1.css?v=v1"><link rel="stylesheet" href="./v1_design.css?v=reference"><link rel="stylesheet" href="./brand_logo_v1.css?v=v2"><script src="./mapping_split_recovery.js?v=routes6"></script><script src="./mapping_split_navigation_fix.js?v=v1"></script><script src="./mapping_progress_interactions_v3.js?v=v1"></script><script src="./mapping_v1_interactions.js?v=v1"></script><script src="./contact_v1.js?v=v1"></script><script src="./hotspot_freshness_live.js?v=v1"></script>')
            preload = '<script>window.__dashboardInitialRoute = location.hash.replace("#", "");</script><script src="./navigation_v1.js?v=routes4"></script>'
            research = '<link rel="stylesheet" href="./research_desk.css?v=2"><link rel="stylesheet" href="./readability.css?v=1"><script defer src="./research_desk.js?v=1"></script>'
            body = html.replace(marker, preload + marker + injected + research).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def run_server(port: int = 4173) -> None:
    from agent.market_runtime import refresh_loop
    threading.Thread(target=refresh_loop, daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(V1DashboardHandler, directory=str(ROOT / "web")))
    print(f"Hardtech Mapping v1: http://127.0.0.1:{port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server(int(os.getenv("MAPPING_PORT", "4173")))
