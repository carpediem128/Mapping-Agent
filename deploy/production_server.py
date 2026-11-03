"""Private origin behind the authenticated Vercel gateway."""
import hmac
import os
import threading
from functools import partial
from urllib.parse import unquote, urlparse

from agent.settings import ROOT
from web_server_v1 import DashboardHTTPServer, V1DashboardHandler


def allowed_path(path):
    path = unquote(urlparse(path).path).lower()
    return not ('\\' in path or any(p.startswith('.') for p in path.split('/') if p)
                or path.endswith(('.db', '.db-wal', '.db-shm', '.sqlite', '.sqlite3', '.bak', '.log')))


class ProductionHandler(V1DashboardHandler):
    def authorized(self):
        token = os.environ.get('MAPPING_BACKEND_TOKEN', '')
        supplied = self.headers.get('X-Mapping-Gateway-Token', '')
        return len(token) >= 32 and hmac.compare_digest(token.encode(), supplied.encode())

    def gate(self):
        if not self.authorized():
            self.send_error(401, 'Gateway authentication required')
            return False
        if not allowed_path(self.path):
            self.send_error(403, 'File access denied')
            return False
        return True

    def do_GET(self):
        if urlparse(self.path).path == '/healthz':
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'ok')
        elif self.gate():
            super().do_GET()

    def do_HEAD(self):
        if self.gate():
            super().do_HEAD()

    def do_POST(self):
        if self.gate():
            super().do_POST()

    def list_directory(self, path):
        self.send_error(403, 'Directory listing disabled')
        return None

    def log_message(self, format, *args):
        # Do not log query strings, passwords, or research input.
        print('HTTP', self.command, urlparse(self.path).path, flush=True)


def main():
    token = os.environ.get('MAPPING_BACKEND_TOKEN', '')
    if len(token) < 32 or 'REPLACE_' in token:
        raise SystemExit('Set MAPPING_BACKEND_TOKEN to a random secret of at least 32 characters')
    for directory in ['web/data', 'web/artifacts', 'runs']:
        (ROOT / directory).mkdir(parents=True, exist_ok=True)
    from agent.market_runtime import refresh_loop
    threading.Thread(target=refresh_loop, daemon=True).start()
    server = DashboardHTTPServer(('0.0.0.0', int(os.getenv('PORT', '4173'))), partial(ProductionHandler, directory=str(ROOT / 'web')))
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
