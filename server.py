"""Aawan Jaawan: local website with Google Sheets or SQLite storage."""
import argparse
import json
import os
import re
import sqlite3
from datetime import date, datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError
from uuid import uuid4

ROUTES = (
  'lko',
  'hyd',
  'aligarh-hyd',
  'hyd-aligarh',
  'delhi-hyd',
  'hyd-delhi',
  'allahabad-hyd',
  'hyd-allahabad',
  'gorakhpur-hyd',
  'hyd-gorakhpur',
)

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('AAWAN_DB', str(ROOT / 'data' / 'community.sqlite3')))
CONFIG = json.loads((ROOT / 'config.json').read_text()) if (ROOT / 'config.json').exists() else {}
SHEETS_URL = os.environ.get('AAWAN_SHEETS_URL', CONFIG.get('sheets_url', '')).strip()


class SheetsError(Exception):
    pass


def sheets_request(post=None):
    """Google redirects ContentService responses; urllib follows the redirect."""
    if not re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec', SHEETS_URL):
        raise SheetsError('Configure a valid Google Apps Script /exec URL.')
    url = SHEETS_URL + ('?api=posts' if post is None else '')
    body = None if post is None else json.dumps(post).encode()
    request = Request(url, data=body, headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urlopen(request, timeout=30) as response:
            result = json.loads(response.read(2_000_000))
    except (ValueError, UnicodeDecodeError) as error:
        raise SheetsError('Google returned a page instead of data. Update Code.gs and deploy a new version with access set to Anyone.') from error
    except (URLError, TimeoutError, OSError) as error:
        raise SheetsError('Cannot reach Google Sheets. Check your connection and deployment access. If posting timed out, check the sheet before retrying.') from error
    if not isinstance(result, dict) or 'ok' not in result:
        raise SheetsError('Update Code.gs and deploy a new version to enable the localhost connection.')
    if result.get('ok') is not True:
        raise SheetsError(str(result.get('error', 'Google Sheets could not complete the request.')))
    data = result.get('data')
    if post is None and not isinstance(data, list):
        raise SheetsError('Google Sheets returned an invalid posts response.')
    if post is not None and (not isinstance(data, dict) or not data.get('id')):
        raise SheetsError('Google Sheets did not confirm that the post was saved. Check the sheet before retrying.')
    return data


def connection():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    return db


def india_today():
    return datetime.now(timezone(timedelta(hours=5, minutes=30))).date()


def validate_post(data):
    limits = {'name': 60, 'phone': 24, 'route': 13, 'date': 10, 'mode': 20, 'help': 40, 'note': 350, 'type': 7}
    post = {}
    for key, limit in limits.items():
        value = data.get(key, '' if key == 'note' else None)
        if not isinstance(value, str) or (key != 'note' and not value.strip()) or len(value.strip()) > limit:
            raise ValueError('Please check your ' + key + '.')
        post[key] = value.strip()
    if post['route'] not in ROUTES or post['type'] not in ('trip', 'request'):
        raise ValueError('Choose a valid route and post type.')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', post['date']) or date.fromisoformat(post['date']) < india_today():
        raise ValueError('Choose today or a future travel date.')
    digits = re.sub(r'\D', '', post['phone'])
    if not re.fullmatch(r'[+0-9 ()-]+', post['phone']) or not 10 <= len(digits) <= 15:
        raise ValueError('Enter a valid WhatsApp number including country code.')
    post['phone'] = '+' + ('91' if len(digits) == 10 else '') + digits
    modes = ('Flight', 'Train', 'Car', 'Not decided') if post['type'] == 'trip' else ('Any mode', 'Flight', 'Train', 'Car', 'Not decided')
    if post['mode'] not in modes:
        raise ValueError('Choose a valid travel mode.')
    helps = ('A small parcel', 'Travel company', 'Anything I can', 'Just sharing my trip') if post['type'] == 'trip' else ('Find a traveller', 'A small parcel', 'Travel company', 'Other')
    if post['help'] not in helps:
        raise ValueError('Choose a valid help option.')
    return post


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)

    def respond(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlparse(self.path).path == '/api/posts':
            if SHEETS_URL:
                try:
                    self.respond(200, sheets_request())
                except SheetsError as error:
                    self.respond(502, {'error': str(error)})
                return
            with connection() as db:
                rows = db.execute('SELECT * FROM posts WHERE date >= ? ORDER BY created DESC', (india_today().isoformat(),)).fetchall()
            self.respond(200, [dict(row) for row in rows])
        else:
            super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != '/api/posts':
            self.respond(404, {'error': 'Not found'})
            return
        # Forms are same-origin; decline browser requests from other origins.
        origin = self.headers.get('Origin')
        if origin and urlparse(origin).netloc != self.headers.get('Host'):
            self.respond(403, {'error': 'Please post from the community board.'})
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 8192:
                raise ValueError('Please keep your post short.')
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError('Invalid post.')
            post = validate_post(data)
        except (ValueError, TypeError, UnicodeDecodeError) as error:
            self.respond(400, {'error': str(error)})
            return
        if SHEETS_URL:
            try:
                self.respond(201, sheets_request(post))
            except SheetsError as error:
                self.respond(502, {'error': str(error)})
            return
        import time
        post.update(id='post-' + uuid4().hex, created=int(time.time() * 1000))
        columns = list(post)
        with connection() as db:
            db.execute('INSERT INTO posts (' + ','.join(columns) + ') VALUES (' + ','.join('?' for _ in columns) + ')', list(post.values()))
        self.respond(201, post)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    if not SHEETS_URL:
        DB.parent.mkdir(parents=True, exist_ok=True)
        with connection() as db:
            db.execute('''CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL,
            route TEXT NOT NULL, date TEXT NOT NULL, mode TEXT NOT NULL,
            help TEXT NOT NULL, note TEXT NOT NULL, type TEXT NOT NULL,
            created INTEGER NOT NULL
        )''')
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f'Aawan Jaawan is ready at http://{args.host}:{args.port}', flush=True)
    print('Storage: Google Sheets' if SHEETS_URL else 'Storage: local SQLite', flush=True)
    httpd.serve_forever()


if __name__ == '__main__':
    main()
