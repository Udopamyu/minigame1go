"""Game team's real-browser acceptance checks; exit nonzero before video handoff."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import time
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def verify(base_url, game_id):
    game_dir = ROOT / 'games' / game_id
    source_hash = hashlib.sha256((game_dir / 'index.html').read_bytes()).hexdigest()
    report = {'status': 'failed', 'game_id': game_id, 'source_sha256': source_hash,
              'checks': [], 'errors': [], 'external_requests': [], 'public_url': None}
    destination = game_dir / 'test-results.json'
    destination.write_text(json.dumps(report, indent=2) + '\n')
    origin = urlsplit(base_url).netloc
    browser_errors, external = [], []

    def check(name, condition):
        report['checks'].append({'name': name, 'passed': bool(condition)})
        if not condition:
            raise AssertionError(name)

    try:
        with sync_playwright() as playwright:
            executable = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
            browser = playwright.chromium.launch(
                executable_path=executable, headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage'])
            context = browser.new_context(viewport={'width': 390, 'height': 844},
                                          is_mobile=True, has_touch=True)
            page = context.new_page()
            page.on('pageerror', lambda error: browser_errors.append(str(error)))
            page.on('request', lambda request: external.append(request.url)
                    if urlsplit(request.url).scheme in ('http', 'https')
                    and urlsplit(request.url).netloc != origin else None)
            response = page.goto(f'{base_url}/games/{game_id}/')
            check('game_served', response is not None and response.ok)
            check('initial_state', page.locator('body').get_attribute('data-state') == 'ready')
            check('mobile_has_no_horizontal_overflow', page.evaluate(
                'document.documentElement.scrollWidth <= innerWidth'))
            page.locator('#start-button').click()
            start = time.monotonic()
            check('starts_playing', page.locator('body').get_attribute('data-state') == 'playing')
            check('timer_starts_at_twelve', float(page.locator('#time-left').inner_text()) >= 11)
            score = int(page.locator('#score').inner_text())
            positions = []
            for _ in range(3):
                positions.append(page.locator('#target').bounding_box())
                page.locator('#target').tap()
            check('touch_increases_score', int(page.locator('#score').inner_text()) == score + 3)
            check('target_moves', len({(box['x'], box['y']) for box in positions}) > 1)
            page.locator('#target').focus()
            page.keyboard.press('Space')
            check('keyboard_increases_score', int(page.locator('#score').inner_text()) == score + 4)
            page.screenshot(path=str(game_dir / 'preview.png'))
            page.wait_for_selector('body[data-state="finished"]', timeout=15000)
            elapsed = time.monotonic() - start
            check('round_lasts_twelve_seconds', 11.5 <= elapsed <= 14.0)
            check('result_visible', page.locator('#result').is_visible())
            final_score = int(page.locator('#score').inner_text())
            # Force a DOM click after expiry to ensure the game guards its scoring code.
            page.locator('#target').evaluate('(target) => target.click()')
            check('no_scoring_after_finish', int(page.locator('#score').inner_text()) == final_score)
            page.locator('#restart-button').click()
            check('restart_resets_score', int(page.locator('#score').inner_text()) == 0)
            check('restart_plays', page.locator('body').get_attribute('data-state') == 'playing')
            desktop_context = browser.new_context(viewport={'width': 1280, 'height': 800})
            desktop = desktop_context.new_page()
            desktop.on('pageerror', lambda error: browser_errors.append(str(error)))
            desktop.on('request', lambda request: external.append(request.url)
                       if urlsplit(request.url).scheme in ('http', 'https')
                       and urlsplit(request.url).netloc != origin else None)
            desktop.goto(f'{base_url}/games/{game_id}/')
            desktop.locator('#start-button').click()
            desktop.locator('#target').click()
            check('desktop_click_scores', int(desktop.locator('#score').inner_text()) == 1)
            check('desktop_has_no_horizontal_overflow', desktop.evaluate(
                'document.documentElement.scrollWidth <= innerWidth'))
            check('no_javascript_errors', not browser_errors)
            check('no_external_requests', not external)
            report['round_elapsed_seconds'] = round(elapsed, 3)
            report['final_score'] = final_score
            report['status'] = 'passed'
            browser.close()
    except Exception as error:
        report['errors'].append(f'{type(error).__name__}: {error}')
    finally:
        report['errors'].extend(browser_errors)
        report['external_requests'] = external
        destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'stage': 'game', 'status': report['status'],
                      'checks': len(report['checks']), 'errors': report['errors']}, ensure_ascii=False))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', required=True)
    parser.add_argument('--game', choices=['tap-spark'], default='tap-spark')
    args = parser.parse_args()
    sys.exit(verify(args.base_url.rstrip('/'), args.game))
