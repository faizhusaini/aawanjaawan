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
