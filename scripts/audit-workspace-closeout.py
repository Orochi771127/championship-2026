"""Read-only census of attached product worktrees; never rewrites their files."""
import collections
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/reports/dex-workspace-closeout-2026-10-19'

def git(root, *args):
    result = subprocess.run(['git', '-c', f'safe.directory={root}', '-C', str(root), *args], capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8', errors='replace'))
    return result.stdout.decode('utf-8', errors='replace')

rows = []
for block in git(ROOT, 'worktree', 'list', '--porcelain').strip().split('\n\n'):
    lines = block.splitlines()
    root = Path(lines[0].removeprefix('worktree '))
    row = {'path': str(root), 'exists': root.exists()}
    if root.exists():
        try:
            row['head'] = git(root, 'rev-parse', 'HEAD').strip()
            row['branch'] = git(root, 'branch', '--show-current').strip()
            row['aheadOfRemoteMain'] = int(git(root, 'rev-list', '--count', 'origin/main..HEAD'))
            row['trackedChanges'] = git(root, 'diff', '--name-only').splitlines()
            row['stagedChanges'] = git(root, 'diff', '--cached', '--name-only').splitlines()
            files = git(root, 'ls-files', '--others', '--exclude-standard', '-z').strip('\0').split('\0')
            files = [f for f in files if f]
            row['untrackedCount'] = len(files)
            row['untrackedGroups'] = dict(collections.Counter('/'.join(f.split('/')[:2]) for f in files))
            row['untrackedSample'] = files[:20]
            row['classification'] = ('ALREADY_IN_REMOTE_MAIN_CLEAN' if not row['aheadOfRemoteMain'] and not row['trackedChanges'] and not row['stagedChanges'] and not files else 'REVIEW_REQUIRED_PRESERVED')
        except RuntimeError as error:
            row['error'] = str(error)
    rows.append(row)
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'worktrees.json').write_text(json.dumps({'baseRemoteMain': git(ROOT, 'rev-parse', 'origin/main').strip(), 'worktrees': rows}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
for row in rows:
    print(row['path'], row.get('classification'), len(row.get('trackedChanges', [])), row.get('untrackedCount'), row.get('aheadOfRemoteMain'))
