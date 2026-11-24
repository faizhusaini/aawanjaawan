"""Regression coverage for original community requests and voluntary itineraries."""
import unittest
from datetime import date
from unittest.mock import patch
import server


class RequirementsTests(unittest.TestCase):
    def setUp(self):
        self.base = dict(name='Community Member', phone='+91 98765 43210', route='lko', date='2099-12-20', mode='Flight', help='Just sharing my trip', note='', type='trip')

    def test_itinerary_without_offering_help_or_notes(self):
        self.assertEqual(server.validate_post(self.base)['help'], 'Just sharing my trip')

    def test_simple_who_is_coming_request(self):
        post = dict(self.base, type='request', mode='Any mode', help='Find a traveller')
        self.assertEqual(server.validate_post(post)['note'], '')

    def test_both_directions_and_all_valid_flow_options(self):
        for direction in ('lko', 'hyd'):
            for kind, modes, helps in (
                ('trip', ('Flight','Train','Car','Not decided'), ('A small parcel','Travel company','Anything I can','Just sharing my trip')),
                ('request', ('Any mode','Flight','Train','Car','Not decided'), ('Find a traveller','A small parcel','Travel company','Other')),
            ):
                for mode in modes:
                    for help_kind in helps:
                        with self.subTest(direction=direction, kind=kind, mode=mode, help=help_kind):
                            post = dict(self.base, route=direction, type=kind, mode=mode, help=help_kind)
                            self.assertEqual(server.validate_post(post)['route'], direction)

    def test_request_cannot_offer_help(self):
        for value in ('Just sharing my trip','Anything I can'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                server.validate_post(dict(self.base, type='request', help=value))

    def test_trip_cannot_use_request_only_fields(self):
        for override in ({'help':'Find a traveller'}, {'help':'Other'}, {'mode':'Any mode'}):
            with self.subTest(override=override), self.assertRaises(ValueError):
                server.validate_post(dict(self.base, **override))

    def test_name_and_contact_required(self):
        for key in ('name','phone','route','date','mode','help','type'):
            for value in ('', '  ', None, [], 1):
                with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                    server.validate_post(dict(self.base, **{key:value}))

    def test_optional_notes_and_trim(self):
        post = dict(self.base, name='  Ayesha Khan  ', note='  hello  ')
        clean = server.validate_post(post)
        self.assertEqual((clean['name'],clean['note']), ('Ayesha Khan','hello'))
        del post['note']
        self.assertEqual(server.validate_post(post)['note'], '')

    def test_contact_normalization(self):
        for value, expected in (('9876543210','+919876543210'),('+91 (98765) 43210','+919876543210'),('+44 7700 900123','+447700900123')):
            with self.subTest(phone=value):
                self.assertEqual(server.validate_post(dict(self.base, phone=value))['phone'], expected)
        for value in ('hello9876543210','123', '+1234567890123456'):
            with self.subTest(phone=value), self.assertRaises(ValueError):
                server.validate_post(dict(self.base, phone=value))

    def test_limits_and_enums(self):
        for key, value in (('name','a'*61),('note','a'*351),('route','bad'),('mode','Boat'),('type','other'),('help','Unknown')):
            with self.subTest(key=key), self.assertRaises(ValueError):
                server.validate_post(dict(self.base, **{key:value}))

    def test_date_boundaries_use_india_today(self):
        with patch.object(server, 'india_today', return_value=date(2026,11,9)):
            self.assertEqual(server.validate_post(dict(self.base, date='2026-11-09'))['date'], '2026-11-09')
            for value in ('2026-11-08','2099-02-31','2099-13-01','2099-1-1','not-a-date'):
                with self.subTest(date=value), self.assertRaises(ValueError):
                    server.validate_post(dict(self.base, date=value))


class SQLiteRegressionTests(unittest.TestCase):
    def test_optional_notes_persist_and_past_posts_hidden(self):
        import tempfile
        import io
        import json
        from pathlib import Path
        from email.message import Message
        with tempfile.TemporaryDirectory() as tmp, patch.object(server, 'SHEETS_URL', ''), patch.object(server, 'DB', Path(tmp)/'posts.sqlite3'):
            with server.connection() as db:
                db.execute('CREATE TABLE posts (id TEXT PRIMARY KEY, name TEXT, phone TEXT, route TEXT, date TEXT, mode TEXT, help TEXT, note TEXT, type TEXT, created INTEGER)')
            post = dict(name='Local Member',phone='9876543210',route='hyd',date='2099-12-20',mode='Any mode',help='Find a traveller',note='',type='request')
            handler=server.Handler.__new__(server.Handler)
            handler.path='/api/posts'
            body=json.dumps(post).encode()
            handler.rfile=io.BytesIO(body)
            handler.headers=Message()
            handler.headers['Content-Length']=str(len(body))
            handler.headers['Host']='localhost:8000'
            result={}
            handler.respond=lambda status,payload:result.update(status=status,data=payload)
            handler.do_POST()
            self.assertEqual(result['status'],201)
            self.assertEqual(result['data']['phone'],'+919876543210')
            handler.do_GET()
            self.assertEqual(len(result['data']),1)
            self.assertEqual(result['data'][0]['note'],'')
            with server.connection() as db:
                db.execute("UPDATE posts SET date='2020-01-01'")
            handler.do_GET()
            self.assertEqual(result['data'],[])


class GeneratedPageTests(unittest.TestCase):
    def test_form_required_fields_and_limits(self):
        from html.parser import HTMLParser
        from pathlib import Path
        class Fields(HTMLParser):
            def __init__(self):
                super().__init__()
                self.fields={}
            def handle_starttag(self, tag, attrs):
                attrs=dict(attrs)
                if tag in ('input','textarea') and attrs.get('name'):
                    self.fields[attrs['name']]=attrs
        page=Fields()
        page.feed(Path('src/index.html').read_text())
        for key in ('name','phone','date'):
            self.assertIn('required',page.fields[key])
        self.assertNotIn('required',page.fields['note'])
        self.assertEqual(page.fields['name']['maxlength'],'60')
        self.assertEqual(page.fields['phone']['maxlength'],'24')
        self.assertEqual(page.fields['note']['maxlength'],'350')

    def test_generated_assets_match_source(self):
        from pathlib import Path
        for name in ('index.html','css/style.css','js/app.js'):
            self.assertEqual((Path('src')/name).read_bytes(),(Path('dist')/name).read_bytes())
        generated=Path('integrations/google-sheets/Index.html').read_text()
        self.assertIn(Path('src/js/app.js').read_text(),generated)
        self.assertIn(Path('src/css/style.css').read_text(),generated)
        self.assertNotIn('src="js/app.js"',generated)
