"""Static local preview. API requests use the configured production Vercel endpoint."""
import os
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

os.chdir(Path(__file__).resolve().parents[1])
class PublicHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?', 1)[0]
        resolved = Path(self.translate_path(self.path)).resolve()
        root = Path.cwd().resolve()
        if resolved == root / 'index.html' or (path == '/' and resolved == root) or resolved.is_relative_to(root / 'assets'):
            return super().do_GET()
        self.send_error(404)

    def list_directory(self, path):
        self.send_error(404)

print('Nexo Visión: http://localhost:5500', flush=True)
ThreadingHTTPServer(('127.0.0.1',5500), PublicHandler).serve_forever()
