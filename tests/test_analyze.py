import base64
import io
import http.client
import json
import os
import threading
import unittest
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import patch
from PIL import Image
from api import analyze as app


def sample_image():
    out = io.BytesIO()
    Image.new('RGB', (80, 50), 'white').save(out, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(out.getvalue()).decode()


class VisionTests(unittest.TestCase):
    def test_cors_local_and_pages(self):
        with patch.dict(os.environ, {'ALLOWED_ORIGINS': 'https://alonsorgt1.github.io', 'ALLOW_LOCALHOST': 'true'}):
            for origin in ['https://alonsorgt1.github.io', 'http://localhost:5173', 'http://127.0.0.1:5500', 'http://[::1]:8000']:
                self.assertTrue(app.origin_allowed(origin), origin)
            for origin in ['', 'null', 'https://evil.com', 'http://localhost.evil.com', 'http://localhost/path', 'http://evil@localhost:3000']:
                self.assertFalse(app.origin_allowed(origin), origin)
        with patch.dict(os.environ, {'ALLOW_LOCALHOST': 'false'}):
            self.assertFalse(app.origin_allowed('http://localhost:3000'))

    def test_invalid_images(self):
        for data in [None, 'https://x.com/a.png', 'data:image/png;base64,???', 'data:image/png;base64,YWJj']:
            with self.assertRaises(ValueError):
                app.read_data_image(data)

    def test_image_dimensions_and_orientation(self):
        data = app.read_data_image(sample_image())
        self.assertEqual((data['width'], data['height']), (80,50))
        self.assertTrue(data['image'].startswith('data:image/jpeg;base64,'))

    def test_no_private_downloads(self):
        for url in ['http://example.com/a.png', 'https://user:pass@example.com/a.png', 'https://example.com:8443/a.png']:
            with self.assertRaises(ValueError):
                app.public_target(url)
        with patch.object(app.socket, 'getaddrinfo', return_value=[(2,1,6,'',('127.0.0.1',443))]):
            with self.assertRaises(ValueError):
                app.public_target('https://example.com/a.png')

    def test_counts_match_unique_marks(self):
        d = {'label':'Tornillo','box':[.1,.1,.2,.4]}
        result = app.validate_result({'note':'', 'detections':[d,d,{'label':'tuerca','box':[.5,.5,.6,.6]}]})
        self.assertEqual(result['count'],2)
        self.assertEqual(result['counts'],{'tornillo':1,'tuerca':1})
        self.assertEqual([d['id'] for d in result['detections']],[1,2])

    def test_no_match(self):
        self.assertEqual(app.validate_result({'note':'No hay tornillos.', 'detections':[]})['count'],0)

    def test_bad_coordinates_rejected(self):
        for box in [[-.1,0,.5,.5],[.5,.1,.2,.8],[0,0,1,float('nan')],[0,0,True,1],[0,0,1]]:
            with self.assertRaises(ValueError):
                app.validate_result({'note':'','detections':[{'label':'tornillo','box':box}]})

    @patch.object(app, 'OpenAI')
    def test_request_and_response_contract(self, client):
        client.return_value.responses.create.return_value = SimpleNamespace(status='completed',output_text=json.dumps({'note':'','detections':[{'label':'tornillo','box':[.1,.2,.3,.4]}]}))
        result = app.analyze({'message':'Cuenta los torniloos','image':sample_image()})
        self.assertEqual(result['count'],1)
        call = client.return_value.responses.create.call_args.kwargs
        self.assertFalse(call['store'])
        self.assertEqual(call['input'][0]['content'][1]['type'],'input_image')
        self.assertTrue(call['text']['format']['strict'])

    @patch.object(app, 'OpenAI')
    def test_incomplete_not_counted(self, client):
        client.return_value.responses.create.return_value = SimpleNamespace(status='incomplete',output_text='')
        with self.assertRaises(RuntimeError):
            app.analyze({'message':'Cuenta tornillos','image':sample_image()})


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1',0),app.handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/api/analyze'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def req(self, method, data=None, origin='http://localhost:5500'):
        request = urllib.request.Request(self.url,data=data,method=method,headers={'Origin':origin,'Content-Type':'application/json'})
        try:
            return urllib.request.urlopen(request)
        except urllib.error.HTTPError as e:
            return e

    def test_preflight(self):
        with self.req('OPTIONS') as res:
            self.assertEqual(res.status,204)
            self.assertEqual(res.headers['Access-Control-Allow-Origin'],'http://localhost:5500')

    def test_forbidden(self):
        with self.req('POST',b'{}','https://evil.com') as res:
            self.assertEqual(res.status,403)
            self.assertIsNone(res.headers.get('Access-Control-Allow-Origin'))

    def test_invalid_json_and_too_large(self):
        with self.req('POST',b'not JSON') as res:
            self.assertEqual(res.status,400)
            self.assertEqual(res.headers['Access-Control-Allow-Origin'],'http://localhost:5500')
        # Test rejection from headers, before sending a body. On Linux an early
        # rejection can close the socket while urllib is still uploading 4 MB.
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        conn.request('POST', '/api/analyze', body=b'', headers={
            'Origin': 'http://localhost:5500', 'Content-Type': 'application/json',
            'Content-Length': str(app.MAX_BODY + 1)})
        with conn.getresponse() as res:
            self.assertEqual(res.status,413)
        conn.close()

    @patch.object(app,'fetch_image',return_value={'image':sample_image(),'width':80,'height':50})
    def test_remote_image(self, fetch):
        with self.req('POST',json.dumps({'action':'load_url','url':'https://example.com/a.png'}).encode()) as res:
            self.assertEqual(res.status,200)
            self.assertEqual(json.load(res)['width'],80)
        fetch.assert_called_once()

if __name__ == '__main__':
    unittest.main()
