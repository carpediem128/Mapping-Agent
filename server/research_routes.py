"""HTTP routes for the persistent research desk."""
import json
from urllib.parse import urlparse, quote
from agent import topic_research


class ResearchRoutes:
    def do_GET(self):
        route = urlparse(self.path).path
        if route == '/api/research':
            self._send_json(200, {'jobs': topic_research.list_jobs()})
            return
        if route.startswith('/api/research/'):
            try:
                parts = route.strip('/').split('/')
                state = topic_research.get_job(parts[2])
                if len(parts) == 4 and parts[3] == 'download':
                    if state['status'] != 'completed':
                        raise ValueError('Research incomplete')
                    body = (topic_research.job_path(parts[2]) / state['filename']).read_bytes()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                    self.send_header('Content-Disposition', "attachment; filename*=UTF-8''" + quote(state['filename']))
                    self.send_header('Content-Length', str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                else:
                    self._send_json(200, state)
            except (ValueError, FileNotFoundError, IndexError):
                self._send_json(404, {'error': 'Research not found'})
            return
        super().do_GET()

    def do_POST(self):
        route = urlparse(self.path).path
        if route == '/api/research' or route.startswith('/api/research/'):
            origin = self.headers.get('Origin')
            if origin and urlparse(origin).netloc != self.headers.get('Host'):
                self._send_json(403, {'error': 'Origin not allowed'})
                return
            try:
                if route == '/api/research':
                    length = int(self.headers.get('Content-Length', 0))
                    if length < 1 or length > 4096:
                        raise ValueError('Invalid request size')
                    data = json.loads(self.rfile.read(length))
                    if not isinstance(data, dict) or not isinstance(data.get('topic'), str):
                        raise ValueError('topic must be a string')
                    self._send_json(202, topic_research.start(data.get('topic', '')))
                elif route.endswith('/publish'):
                    self._send_json(200, topic_research.publish(route.split('/')[3]))
                else:
                    self._send_json(404, {'error': 'Unknown endpoint'})
            except (ValueError, FileNotFoundError) as exc:
                self._send_json(400, {'error': str(exc)})
            return
        super().do_POST()
