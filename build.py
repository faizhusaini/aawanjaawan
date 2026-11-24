"""Build static assets for Cloudflare, local previews, and the legacy Sheets app."""
from pathlib import Path
import re
from shutil import copy2, rmtree

ROOT = Path(__file__).resolve().parent
ASSETS = ('index.html', 'css/style.css', 'js/app.js', 'icon.svg', 'robots.txt')


def copy_assets(destination):
    # Both destinations contain generated files only. Remove obsolete assets so
    # templates or server configuration cannot accidentally ship with the app.
    if destination.exists():
        rmtree(destination)
    for name in ASSETS:
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        copy2(ROOT / 'src' / name, target)


def build():
    copy_assets(ROOT / 'dist')
    copy_assets(ROOT / 'cloudflare' / 'public')

    page = (ROOT / 'src' / 'index.html').read_text()
    css = (ROOT / 'src' / 'css' / 'style.css').read_text()
    script = (ROOT / 'src' / 'js' / 'app.js').read_text()
    page, styles = re.subn(
        r'<link\b[^>]*href="css/style.css"[^>]*>',
        lambda _: '<style>' + css + '</style>', page,
    )
    page, scripts = re.subn(
        r'<script\s+src="js/app.js"\s*>\s*</script>',
        lambda _: '<script>' + script + '</script>', page,
    )
    if styles != 1 or scripts != 1:
        raise RuntimeError('Expected one app stylesheet and script in src/index.html.')
    # Apps Script serves only Index.html, so embed the favicon as well.
    from urllib.parse import quote
    icon = 'data:image/svg+xml,' + quote((ROOT / 'src' / 'icon.svg').read_text())
    page = page.replace('href="icon.svg"', 'href="' + icon + '"')
    target = ROOT / 'integrations' / 'google-sheets' / 'Index.html'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(page)
    print('Built dist/, cloudflare/public/, and legacy Google Sheets Index.html')


if __name__ == '__main__':
    build()
