"""Commit, reconcile GitHub initialization, and push without rewriting history."""
import argparse
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
IDENTITY = ['-c', 'user.name=Faiz Husaini', '-c', 'user.email=faizhusaini19@gmail.com']
# Only initialization documentation is safe to reconcile without a code review.
INITIAL_DOCUMENTS = {'README.md', 'LICENSE', 'LICENSE.txt'}


def git(*arguments, capture=False, check=True):
    return subprocess.run(
        ['git', *arguments], cwd=ROOT, check=check, text=True,
        stdout=subprocess.PIPE if capture else None,
    )


def integrate_remote(branch, fetch=True):
    if fetch:
        git('fetch', 'origin')
    ref = 'refs/remotes/origin/' + branch
    exists = git('show-ref', '--verify', '--quiet', ref, check=False)
    if exists.returncode == 1:
        if not fetch:
            raise RuntimeError('Use IntelliJ Git → Fetch first, then run prepare again.')
        return  # A new, empty repository has no branch to merge.
    if exists.returncode != 0:
        raise RuntimeError('Unable to inspect the remote branch; publishing stopped.')
    result = git(*IDENTITY, 'merge', '--no-edit', '--allow-unrelated-histories', ref, check=False)
    if result.returncode == 0:
        return
    conflicts = git('diff', '--name-only', '--diff-filter=U', capture=True).stdout.splitlines()
    if not conflicts or not set(conflicts).issubset(INITIAL_DOCUMENTS):
        raise RuntimeError('Merge needs review. No force push was attempted. Share the conflict filenames shown by git status.')
    # Preserve GitHub's original document in the repository, while retaining the
    # reviewed app documentation at its normal path. Never discard remote text.
    imported = ROOT / 'docs' / 'github-initial'
    documents = {}
    for name in conflicts:
        target = imported / name
        if target.exists():
            raise RuntimeError('An imported document already exists; review the merge manually.')
        documents[name] = git('show', ':3:' + name, capture=True).stdout
    imported.mkdir(parents=True, exist_ok=True)
    for name, text in documents.items():
        target = imported / name
        target.write_text(text)
        git('checkout', '--ours', '--', name)
        git('add', '--', name, str(target.relative_to(ROOT)))
    git(*IDENTITY, 'commit', '-m', 'Merge GitHub initialization and preserve original documentation')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('repository', nargs='?', help='Repository URL; prompted if origin is missing.')
    parser.add_argument('--prepare-only', action='store_true', help='Merge already-fetched history locally; finish with IntelliJ Git → Push.')
    options = parser.parse_args()
    # Do not accidentally commit an incomplete merge from another workflow.
    if git('ls-files', '--unmerged', capture=True).stdout.strip():
        raise RuntimeError('There are unresolved merge conflicts. Share git status before continuing.')
    remotes = git('remote', capture=True).stdout.splitlines()
    origin = git('remote', 'get-url', 'origin', capture=True).stdout.strip() if 'origin' in remotes else None
    repository = options.repository or origin
    if not repository:
        repository = input('Paste your GitHub/GitLab repository URL: ').strip()
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
    changes = git('diff', '--cached', '--quiet', check=False)
    if changes.returncode == 1:
        initial = git('rev-parse', '--verify', 'HEAD', capture=True, check=False).returncode != 0
        message = 'feat: launch Aawan Jaawan community travel board' if initial else 'chore: refine project documentation and publishing workflow'
        git(*IDENTITY, 'commit', '-m', message)
    elif changes.returncode != 0:
        raise RuntimeError('Unable to inspect staged changes; publishing stopped.')
    integrate_remote(branch, fetch=not options.prepare_only)
    if options.prepare_only:
        print('Local commits and merge are ready. Use IntelliJ Git → Push to publish with your IDE login.')
        return
    git('push', '--set-upstream', 'origin', branch)
    print('Commit and push completed. Website deployment remains a separate step.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print('Publish stopped:', error, file=sys.stderr)
        sys.exit(1)
