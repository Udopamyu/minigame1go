"""Coordinator: local game acceptance -> genuine browser recording -> handoff review."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import sys
from threading import Thread

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


@contextmanager
def local_server():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    worker = Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}'
    finally:
        server.shutdown()
        server.server_close()
        worker.join()


def run(game_id):
    run_dir = ROOT / 'runs' / game_id
    run_dir.mkdir(parents=True, exist_ok=True)
    manifest = {'game_id': game_id, 'status': 'running',
                'started_at': datetime.now(timezone.utc).isoformat(),
                'stages': [], 'public_url': None, 'publication_status': 'not_published',
                'human_review': 'pending'}
    destination = run_dir / 'latest.json'

    def save():
        destination.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

    save()
    # Invalidate old approvals before any stage, including when server launch fails.
    for path in (ROOT / 'games' / game_id / 'test-results.json',
                 ROOT / 'videos' / game_id / 'checklist.json',
                 ROOT / 'videos' / game_id / 'recording.json'):
        if path.exists():
            path.unlink()
    try:
        with local_server() as base_url:
            for team, script in [('game', 'verify_game.py'), ('video', 'record_gameplay.py')]:
                result = subprocess.run([sys.executable, str(ROOT / 'scripts' / script),
                                         '--base-url', base_url, '--game', game_id],
                                        cwd=ROOT, timeout=120, check=False)
                manifest['stages'].append({'team': team, 'exit_code': result.returncode})
                save()
                if result.returncode:
                    raise RuntimeError(f'{team} stage failed; next handoff blocked')
        required = [f'specs/{game_id}.md', f'games/{game_id}/index.html',
                    f'games/{game_id}/README.md', f'games/{game_id}/test-results.json',
                    f'videos/{game_id}/gameplay.mp4', f'videos/{game_id}/script.md',
                    f'videos/{game_id}/post-draft.md', f'videos/{game_id}/recording.json',
                    f'videos/{game_id}/checklist.json']
        manifest['artifacts'] = {}
        for relative in required:
            path = ROOT / relative
            if not path.is_file() or not path.stat().st_size:
                raise RuntimeError(f'Missing or empty artifact: {relative}')
            manifest['artifacts'][relative] = {'bytes': path.stat().st_size,
                                              'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        checks = json.loads((ROOT / 'videos' / game_id / 'checklist.json').read_text())
        if checks['status'] != 'passed':
            raise RuntimeError('Video checklist has not passed')
        manifest['status'] = 'passed_local'
        manifest['stages'].append({'team': 'coordinator', 'status': 'artifacts_verified'})
    except Exception as error:
        manifest['status'] = 'failed'
        manifest['error'] = f'{type(error).__name__}: {error}'
    finally:
        manifest['finished_at'] = datetime.now(timezone.utc).isoformat()
        save()
    print(json.dumps({'status': manifest['status'], 'report': str(destination),
                      'public_url': None, 'human_review': 'pending'}, ensure_ascii=False))
    return 0 if manifest['status'] == 'passed_local' else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', choices=['tap-spark'], default='tap-spark')
    args = parser.parse_args()
    sys.exit(run(args.game))
