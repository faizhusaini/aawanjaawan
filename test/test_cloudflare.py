"""Exercise the deployable D1 schema with SQLite, and verify asset packaging."""
import json
import re
import sqlite3
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


class CloudflareTests(unittest.TestCase):
    def test_real_migration_and_active_listing(self):
        db=sqlite3.connect(':memory:')
        self.addCleanup(db.close)
        schema=(ROOT/'cloudflare/migrations/0001_posts.sql').read_text()
        db.executescript(schema)
        db.executescript(schema)
        worker=(ROOT/'cloudflare/worker.mjs').read_text()
        insert=re.search(r"prepare\(\s*'(INSERT INTO posts[^']+)'\s*,?\s*\)",worker).group(1)
        query=re.search(r'prepare\(\s*"(SELECT id,name[^\"]+)"\s*,?\s*\)',worker).group(1)
        base=['post-1','Member','+919876543210','lko','2099-12-20','Any mode','Find a traveller','','request',1,'active']
        db.execute(insert,base)
        migration=(ROOT/'cloudflare/migrations/0002_city_routes.sql').read_text()
        db.executescript(migration)
        self.assertEqual(db.execute('SELECT * FROM posts').fetchone(), tuple(base))
        for route in ('aligarh-hyd', 'delhi-hyd', 'allahabad-hyd', 'gorakhpur-hyd'):
            for direction in (route, 'hyd-' + route.removesuffix('-hyd')):
                db.execute('UPDATE posts SET route=?', (direction,))
                self.assertEqual(db.execute(query, ('2026-11-24',)).fetchone()[3], direction)
        self.assertEqual(len(db.execute(query,('2026-11-24',)).fetchall()),1)
        for status in ('completed','cancelled'):
            db.execute('UPDATE posts SET status=?',(status,))
            self.assertEqual(db.execute(query,('2026-11-24',)).fetchall(),[])
        db.execute("UPDATE posts SET status='active',date='2020-01-01'")
        self.assertEqual(db.execute(query,('2026-11-24',)).fetchall(),[])
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("UPDATE posts SET route='invalid'")
        indexes=db.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()
        self.assertIn(('posts_active_date',),indexes)

    def test_config_and_public_assets(self):
        text=(ROOT/'cloudflare/wrangler.jsonc').read_text()
        config=json.loads(re.sub(r'^\s*//.*$','',text,flags=re.MULTILINE))
        self.assertEqual(config['d1_databases'][0]['binding'],'DB')
        self.assertEqual(config['assets']['directory'],'./public')
        self.assertTrue(config['assets']['run_worker_first'])
        for name in ('index.html','css/style.css','js/app.js'):
            self.assertEqual((ROOT/'src'/name).read_bytes(),(ROOT/'cloudflare/public'/name).read_bytes())
        self.assertFalse((ROOT/'cloudflare/public/config.json').exists())
        self.assertFalse((ROOT/'cloudflare/public/worker.mjs').exists())

    def test_staging_uses_separate_worker_and_database(self):
        production = json.loads((ROOT / 'cloudflare/wrangler.jsonc').read_text())
        staging_config = ROOT / 'cloudflare/wrangler.dev.jsonc'
        if not staging_config.is_file():
            self.skipTest('Staging config is present on dev.')
        staging = json.loads(staging_config.read_text())
        production_db = production['d1_databases'][0]
        staging_db, = staging['d1_databases']
        self.assertEqual(staging['name'], 'aawanjaawan-dev')
        self.assertNotEqual(staging['name'], production['name'])
        self.assertTrue(staging['workers_dev'])
        self.assertFalse(staging.get('routes'))
        self.assertEqual(staging['main'], production['main'])
        self.assertEqual(staging['assets'], production['assets'])
        self.assertEqual(staging_db['binding'], production_db['binding'])
        self.assertEqual(staging_db['migrations_dir'], production_db['migrations_dir'])
        self.assertEqual(staging_db['database_name'], 'aawanjaawan-dev')
        self.assertNotEqual(staging_db['database_id'], production_db['database_id'])


class LaunchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import sys
        sys.path.insert(0,str(ROOT/'cloudflare'))
        import launch
        cls.launch=launch
        sys.path.pop(0)

    def test_empty_account_selects_no_database(self):
        self.assertIsNone(self.launch.select_database([]))

    def test_existing_database_reused(self):
        items=[{'name':'aawanjaawan','uuid':'real-id'}]
        self.assertEqual(self.launch.select_database(items),'real-id')

    def test_configured_database_checked_against_account(self):
        with self.assertRaises(RuntimeError):
            self.launch.select_database([],configured_id='configured-id')
        self.assertEqual(self.launch.select_database([{'name':'aawanjaawan','uuid':'configured-id'}],'configured-id'),'configured-id')

    def test_ambiguous_selection_stops(self):
        with self.assertRaises(RuntimeError):
            self.launch.select_database([{'name':'aawanjaawan','uuid':'one'},{'name':'aawanjaawan','uuid':'two'}])
