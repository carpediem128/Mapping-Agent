import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from functools import partial
from pathlib import Path
from unittest.mock import patch

from deploy.production_server import ProductionHandler, allowed_path
from web_server_v1 import DashboardHTTPServer


class ProductionTests(unittest.TestCase):
    def test_blocks_private_files(self):
        for path in ['/data/mapping.db', '/data/contact_updates.db-wal', '/.env', '/%2eenv', '/data/secret.sqlite?download=1']:
            self.assertFalse(allowed_path(path), path)
        self.assertTrue(allowed_path('/data/site_data.json'))
        self.assertTrue(allowed_path('/api/research'))

    def test_auth_gate_health_and_file_access(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'MAPPING_BACKEND_TOKEN': 'x' * 40}):
            Path(directory, 'test.txt').write_text('test', encoding='utf-8')
            server = DashboardHTTPServer(('127.0.0.1', 0), partial(ProductionHandler, directory=directory))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f'http://127.0.0.1:{server.server_port}'
            try:
                with urllib.request.urlopen(base + '/healthz') as response:
                    self.assertEqual(response.status, 200)
                with self.assertRaises(urllib.error.HTTPError) as error:
                    urllib.request.urlopen(base + '/test.txt')
                self.assertEqual(error.exception.code, 401)
                request = urllib.request.Request(base + '/test.txt', headers={'X-Mapping-Gateway-Token': 'x' * 40})
                with urllib.request.urlopen(request) as response:
                    self.assertEqual(response.read(), b'test')
                request = urllib.request.Request(base + '/data/mapping.db', headers={'X-Mapping-Gateway-Token': 'x' * 40})
                with self.assertRaises(urllib.error.HTTPError) as error:
                    urllib.request.urlopen(request)
                self.assertEqual(error.exception.code, 403)
            finally:
                server.shutdown()
                server.server_close()
                thread.join()


if __name__ == '__main__':
    unittest.main()
