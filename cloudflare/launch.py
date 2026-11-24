"""Build, verify, provision/reuse D1, and publish using your Wrangler login."""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

from configure import configure

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
WRANGLER = HERE / 'node_modules' / '.bin' / 'wrangler'


def run(arguments, cwd=HERE, capture=False):
    result = subprocess.run([str(arg) for arg in arguments], cwd=cwd, check=True,
                            text=True, stdout=subprocess.PIPE if capture else None)
    return result.stdout if capture else None


def databases():
    result = json.loads(run([WRANGLER, 'd1', 'list', '--json'], capture=True))
    if not isinstance(result, list):
        raise RuntimeError('Unexpected database listing. No database has been selected.')
    return result


def select_database(items, configured_id=None):
    matches = [item for item in items if item.get('name') == 'aawanjaawan']
    if configured_id and configured_id != 'REPLACE_WITH_DATABASE_ID':
        exact = [item for item in matches if item.get('uuid') == configured_id]
        if len(exact) != 1:
            raise RuntimeError('Configured database is not in this account. Check the Cloudflare account before changing anything.')
        return exact[0]['uuid']
    if len(matches) > 1:
        raise RuntimeError('More than one matching database found. Select the intended database manually.')
    if matches:
        return matches[0]['uuid']
    return None


def main():
    if not shutil.which('node') or not WRANGLER.exists():
        raise RuntimeError('Run this in your IntelliJ terminal after Node.js and npm install are available.')
    os.environ.setdefault('WRANGLER_SEND_METRICS', 'false')
    log_dir = HERE / '.wrangler' / 'logs'
    log_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault('WRANGLER_LOG_PATH', str(log_dir / 'launch.log'))
    run([sys.executable, ROOT / 'build.py'])
    run(['node', '--test', ROOT / 'test' / 'worker.test.mjs', ROOT / 'test' / 'frontend.test.mjs'])
    run([sys.executable, '-m', 'unittest', 'discover', '-s', 'test', '-p', 'test_*.py'], cwd=ROOT)
    run([WRANGLER, 'deploy', '--dry-run'])
    run([WRANGLER, 'whoami'])
    config = json.loads(re.sub(r'^\s*//.*$', '', (HERE / 'wrangler.jsonc').read_text(), flags=re.MULTILINE))
    configured_id = config['d1_databases'][0]['database_id']
    database_id = select_database(databases(), configured_id)
    if database_id is None:
        # Only create after a successful listing proved no matching DB exists.
        # Stop on failure; a subsequent run lists again before attempting creation.
        run([WRANGLER, 'd1', 'create', 'aawanjaawan', '--location', 'apac', '--update-config=false'])
        database_id = select_database(databases())
        if database_id is None:
            raise RuntimeError('Database creation is not confirmed. Inspect Cloudflare before retrying.')
    configure(database_id=database_id)
    print('Using verified database ID:', database_id, flush=True)
    run([WRANGLER, 'd1', 'migrations', 'apply', 'DB', '--remote'])
    run([WRANGLER, 'deploy'])
    print('\nUse the deployed URL printed by Wrangler to verify /api/health and post a test trip.', flush=True)
    if config.get('routes'):
        print('Verify the configured custom domains and their /api/health endpoints.', flush=True)
    else:
        print('To connect a custom domain, follow cloudflare/README.md.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, OSError, subprocess.CalledProcessError) as error:
        print('Launch stopped:', error, file=sys.stderr)
        sys.exit(1)
