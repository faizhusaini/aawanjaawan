"""Test remote reconciliation without using the user's repository or network."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('publish', Path(__file__).resolve().parents[1] / 'scripts' / 'publish.py')
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)


def result(code=0, text=''):
    return subprocess.CompletedProcess([], code, stdout=text)


class PublishTests(unittest.TestCase):
    def test_empty_remote_needs_no_merge(self):
        with patch.object(publish, 'git', side_effect=[result(), result(1)]) as git:
            publish.integrate_remote('main')
            self.assertEqual(git.call_count, 2)

    def test_successful_merge_keeps_remote_history(self):
        with patch.object(publish, 'git', side_effect=[result(), result(), result()]) as git:
            publish.integrate_remote('main')
            merge = git.call_args_list[-1].args
            self.assertIn('--allow-unrelated-histories', merge)
            self.assertNotIn('--force', merge)

    def test_readme_conflict_preserves_remote_copy(self):
        with tempfile.TemporaryDirectory() as temp:
            calls=[]
            def fake_git(*args, **kwargs):
                calls.append(args)
                if 'merge' in args:
                    return result(1)
                if args[:3] == ('diff','--name-only','--diff-filter=U'):
                    return result(text='README.md\n')
                if args[0] == 'show':
                    return result(text='# Original GitHub README\n')
                return result()
            with patch.object(publish, 'ROOT', Path(temp)), patch.object(publish, 'git', side_effect=fake_git):
                publish.integrate_remote('main')
            self.assertEqual((Path(temp)/'docs/github-initial/README.md').read_text(), '# Original GitHub README\n')
            self.assertIn(('checkout','--ours','--','README.md'),calls)
            self.assertTrue(any('commit' in call for call in calls))

    def test_code_conflict_is_not_resolved_automatically(self):
        with patch.object(publish, 'git', side_effect=[result(),result(),result(1),result(text='src/js/app.js\n')]) as git:
            with self.assertRaisesRegex(RuntimeError, 'Merge needs review'):
                publish.integrate_remote('main')
            self.assertEqual(git.call_count,4)

    def test_failed_ref_inspection_stops(self):
        with patch.object(publish, 'git', side_effect=[result(),result(128)]):
            with self.assertRaisesRegex(RuntimeError, 'inspect the remote branch'):
                publish.integrate_remote('main')

    def test_prepare_only_does_not_use_network(self):
        with patch.object(publish, 'git', side_effect=[result(), result()]) as git:
            publish.integrate_remote('main', fetch=False)
            self.assertEqual(git.call_count, 2)
            self.assertFalse(any('fetch' in call.args for call in git.call_args_list))

    def test_prepare_requires_a_fetched_branch(self):
        with patch.object(publish, 'git', return_value=result(1)):
            with self.assertRaisesRegex(RuntimeError, 'Fetch first'):
                publish.integrate_remote('main', fetch=False)
