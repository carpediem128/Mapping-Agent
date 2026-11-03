"""Persistent manual contact confirmations, separate from imported research."""
import json
import sqlite3
from datetime import datetime, timezone
from urllib.parse import urlparse

from agent.settings import ROOT


def company_key(value):
    return ''.join(str(value).split()).lower()


def connect():
    db = sqlite3.connect(ROOT / 'web/data/contact_updates.db', timeout=15)
    db.execute('CREATE TABLE IF NOT EXISTS confirmations (company_key TEXT PRIMARY KEY, reached INTEGER NOT NULL, updated_at TEXT NOT NULL)')
    return db


class ContactRoutes:
    def contact_json(self, value, status=200):
        body = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlparse(self.path).path.startswith('/data/contact_updates.db'):
            return self.contact_json({'error': 'Database download disabled'}, 403)
        if urlparse(self.path).path != '/api/contact-confirmations':
            return super().do_GET()
        with connect() as db:
            rows = db.execute('SELECT company_key, reached, updated_at FROM confirmations').fetchall()
        self.contact_json({'confirmations': {k: {'reached': bool(v), 'updated_at': t} for k, v, t in rows}})

    def do_POST(self):
        if urlparse(self.path).path != '/api/contact-confirmations':
            return super().do_POST()
        origin = self.headers.get('Origin')
        if origin and urlparse(origin).netloc != self.headers.get('Host'):
            return self.contact_json({'error': 'Cross-origin write rejected'}, 403)
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 4096 or 'application/json' not in self.headers.get('Content-Type', ''):
                return self.contact_json({'error': 'Expected small JSON request'}, 400)
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError('Expected JSON object')
            key = company_key(data['company'])
            if type(data.get('reached')) is not bool:
                raise ValueError('reached must be boolean')
            site = json.loads((ROOT / 'web/data/site_data.json').read_text(encoding='utf-8'))
            known = {company_key(r.get('company', '')) for r in site.get('contact_progress', {}).get('rows', [])}
            if not key or key not in known:
                return self.contact_json({'error': 'Unknown company'}, 404)
            timestamp = datetime.now(timezone.utc).isoformat()
            with connect() as db:
                db.execute('INSERT INTO confirmations VALUES (?, ?, ?) ON CONFLICT(company_key) DO UPDATE SET reached=excluded.reached, updated_at=excluded.updated_at', (key, int(data['reached']), timestamp))
            self.contact_json({'key': key, 'reached': data['reached'], 'updated_at': timestamp})
        except (KeyError, ValueError, TypeError):
            self.contact_json({'error': 'Invalid contact confirmation'}, 400)
