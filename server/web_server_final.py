from __future__ import annotations

from functools import partial
from http.server import ThreadingHTTPServer
from urllib.parse import urlparse

from server import web_server_llm_fixed as base


class FinalDashboardHandler(base.LLMDatabaseMappingDashboardHandler):
    """Serve the existing dashboard with the raw-Excel Mapping view enabled."""

    server_version = "HardtechMappingServer/0.6-final"

    def do_GET(self) -> None:
        if urlparse(self.path).path == "/":
            html = (base.database_server.WEB_DIR / "index.html").read_text(encoding="utf-8")
            marker = '<script src="./app.js?v=20260715"></script>'
            injected = '<link rel="stylesheet" href="./mapping_ui_fix.css?v=20260727"><script src="./mapping_ui_fix.js?v=20260727"></script>'
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
    handler = partial(FinalDashboardHandler, directory=str(base.database_server.WEB_DIR))
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
