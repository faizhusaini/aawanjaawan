"""Store a real D1 ID and optionally enable the purchased custom domain."""
import argparse
import json
import re
from pathlib import Path
from uuid import UUID

CONFIG = Path(__file__).resolve().parent / 'wrangler.jsonc'


def configure(database_id=None, domain=False):
    text = CONFIG.read_text()
    config = json.loads(re.sub(r'^\s*//.*$', '', text, flags=re.MULTILINE))
    if database_id:
        UUID(database_id)  # Fail before modifying the file if it is not a D1 UUID.
        config['d1_databases'][0]['database_id'] = database_id
    if domain:
        config['routes'] = [
            {'pattern': 'aawanjaawan.fun', 'custom_domain': True},
            {'pattern': 'www.aawanjaawan.fun', 'custom_domain': True},
        ]
    temporary = CONFIG.with_suffix('.tmp')
    temporary.write_text(json.dumps(config, indent=2) + '\n')
    temporary.replace(CONFIG)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-id')
    parser.add_argument('--enable-domain', action='store_true', help='Use only after aawanjaawan.fun is an active Cloudflare zone.')
    options = parser.parse_args()
    if not options.database_id and not options.enable_domain:
        parser.error('Provide --database-id or --enable-domain.')
    configure(options.database_id, options.enable_domain)
    print('Cloudflare configuration updated.')
