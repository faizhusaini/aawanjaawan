"""Commit the reviewed project and push from a terminal with Git/network access."""
import argparse
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def git(*arguments, capture=False, check=True):
    return subprocess.run(
        ['git', *arguments], cwd=ROOT, check=check, text=True,
        stdout=subprocess.PIPE if capture else None,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('repository', nargs='?', help='Repository URL; prompted if origin is missing.')
    options = parser.parse_args()
    remotes = git('remote', capture=True).stdout.splitlines()
    origin = git('remote', 'get-url', 'origin', capture=True).stdout.strip() if 'origin' in remotes else None
    repository = options.repository or origin
    if not repository:
        repository = input('Paste your empty GitHub/GitLab repository URL: ').strip()
    if not repository or not repository.startswith(('https://', 'ssh://', 'git@')):
        raise ValueError('Provide an HTTPS or SSH Git repository URL. Do not include access tokens in the URL.')
    if repository.startswith('https://') and (urlsplit(repository).username or urlsplit(repository).password):
        raise ValueError('Use a repository URL without embedded credentials.')
    if origin and repository != origin:
        raise ValueError('origin already points to a different repository; inspect it before changing anything.')
    if not origin:
        git('remote', 'add', 'origin', repository)
    branch = git('branch', '--show-current', capture=True).stdout.strip()
    if not branch:
        raise ValueError('Check out a branch before publishing; detached HEAD is not supported.')
    git('add', '.')
    # Use an explicit per-command identity, without changing global Git settings.
    changes = git('diff', '--cached', '--quiet', check=False)
    if changes.returncode == 1:
        git('-c', 'user.name=Faiz Husaini', '-c', 'user.email=faizhusaini19@gmail.com',
            'commit', '-m', 'feat: launch Aawan Jaawan community travel board')
    elif changes.returncode != 0:
        raise RuntimeError('Unable to inspect staged changes; publishing stopped.')
    git('push', '--set-upstream', 'origin', branch)
    print('Commit and push completed. Website deployment remains a separate step.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print('Publish stopped:', error, file=sys.stderr)
        sys.exit(1)
