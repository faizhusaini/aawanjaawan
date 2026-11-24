"""Test Sheets routing and failure handling without modifying the live sheet."""
import io
import json
import unittest
from email.message import Message
from unittest.mock import patch
from urllib.error import URLError

import server


class SheetsTests(unittest.TestCase):
    def setUp(self):
        self.url = patch.object(server, 'SHEETS_URL', 'https://script.google.com/macros/s/test-deployment/exec')
        self.url.start()
        self.addCleanup(self.url.stop)

    def response(self, value):
        return io.BytesIO(json.dumps(value).encode())

    def handler(self, method, post=None):
        handler = server.Handler.__new__(server.Handler)
        handler.path = '/api/posts'
        body = json.dumps(post).encode()
        handler.rfile = io.BytesIO(body)
        handler.headers = Message()
        handler.headers['Content-Length'] = str(len(body))
        handler.headers['Host'] = 'localhost:8000'
        result = {}
        handler.respond = lambda status, payload: result.update(status=status, data=payload)
        getattr(handler, method)()
        return result

    def test_read_request(self):
        with patch.object(server, 'urlopen', return_value=self.response({'ok': True, 'data': []})) as send:
            self.assertEqual(server.sheets_request(), [])
            request = send.call_args.args[0]
            self.assertEqual(request.full_url, server.SHEETS_URL + '?api=posts')
            self.assertEqual(request.get_method(), 'GET')

    def test_post_request(self):
        with patch.object(server, 'urlopen', return_value=self.response({'ok': True, 'data': {'id': 'new'}})) as send:
            self.assertEqual(server.sheets_request({'name': 'Member'}), {'id': 'new'})
            request = send.call_args.args[0]
            self.assertEqual(request.get_method(), 'POST')
            self.assertEqual(json.loads(request.data), {'name': 'Member'})

    def test_old_deployment_and_login_page(self):
        with patch.object(server, 'urlopen', return_value=io.BytesIO(b'<html>Sign in</html>')):
            with self.assertRaisesRegex(server.SheetsError, 'Update Code.gs'):
                server.sheets_request()

    def test_google_error_is_not_success(self):
        with patch.object(server, 'urlopen', return_value=self.response({'ok': False, 'error': 'Run setup'})):
            with self.assertRaisesRegex(server.SheetsError, 'Run setup'):
                server.sheets_request()

    def test_network_failure(self):
        with patch.object(server, 'urlopen', side_effect=URLError('offline')) as send:
            with self.assertRaisesRegex(server.SheetsError, 'check the sheet before retrying'):
                server.sheets_request({'name': 'Member'})
            self.assertEqual(send.call_count, 1)

    def test_routes_use_sheets_without_local_database(self):
        post = dict(name='Test Member', phone='+91 98765 43210', route='lko', date='2099-12-20', mode='Flight', help='A small parcel', note='Test', type='trip')
        with patch.object(server, 'connection', side_effect=AssertionError('SQLite must not be used')):
            with patch.object(server, 'sheets_request', return_value=[]) as read:
                self.assertEqual(self.handler('do_GET'), {'status': 200, 'data': []})
                read.assert_called_once_with()
            with patch.object(server, 'sheets_request', return_value={**post, 'id': 'saved'}) as write:
                self.assertEqual(self.handler('do_POST', post)['status'], 201)
                self.assertEqual(write.call_args.args[0]['note'], 'Test')
            with patch.object(server, 'sheets_request', side_effect=server.SheetsError('Unavailable')):
                self.assertEqual(self.handler('do_GET')['status'], 502)
                self.assertEqual(self.handler('do_POST', post)['status'], 502)

    def test_invalid_post_never_reaches_google(self):
        with patch.object(server, 'sheets_request') as send:
            self.assertEqual(self.handler('do_POST', {})['status'], 400)
            send.assert_not_called()

    def test_invalid_remote_payload(self):
        for payload in ({'ok': True, 'data': {}}, {'data': []}):
            with self.subTest(payload=payload), patch.object(server, 'urlopen', return_value=self.response(payload)):
                with self.assertRaises(server.SheetsError):
                    server.sheets_request()


if __name__ == '__main__':
    unittest.main()
