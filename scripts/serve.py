"""Static local preview. API requests use the configured production Vercel endpoint."""
import os
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

os.chdir(Path(__file__).resolve().parents[1])
class PublicHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path in ('/', '/index.html') or path.startswith('/assets/'):
            return super().do_GET()
        self.send_error(404)

    def list_directory(self, path):
        self.send_error(404)

print('Nexo Visión: http://localhost:5500', flush=True)
ThreadingHTTPServer(('127.0.0.1',5500), PublicHandler).serve_forever()
