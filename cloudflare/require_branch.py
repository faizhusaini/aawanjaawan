"""Stop a deployment when the checkout is on the wrong branch."""
import subprocess
import sys


if __name__ == '__main__':
    expected = sys.argv[1]
    current = subprocess.check_output(
        ['git', 'branch', '--show-current'], text=True
    ).strip()
    if current != expected:
        sys.exit(f'Deployment requires branch {expected}; current checkout: {current or "detached HEAD"}.')
