"""Bounded market refresh worker and explicit source-date verification."""
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from agent.settings import ROOT


def limit_request_timeouts():
    # Only used by the standalone market worker, never by GLM request handlers.
    import requests
    original = requests.sessions.Session.request
    if getattr(original, '_mapping_bounded', False):
        return

    def bounded(self, method, url, **kwargs):
        if kwargs.get('timeout') is None:
            kwargs['timeout'] = (10, 30)
        return original(self, method, url, **kwargs)

    bounded._mapping_bounded = True
    requests.sessions.Session.request = bounded


def verify_market_date(ak, rows):
    """Use a returned daily bar date; collection time is never a quote date."""
    current = datetime.now(ZoneInfo('Asia/Shanghai'))
    errors = []
    for row in rows[:2]:
        try:
            frame = ak.stock_board_concept_hist_em(
                symbol=row.get('board_code') or row['name'],
                start_date=(current - timedelta(days=20)).strftime('%Y%m%d'),
                end_date=current.strftime('%Y%m%d'))
            dates = [str(value)[:10] for value in frame['日期'].tolist()]
            valid = [value for value in dates if (current - timedelta(days=20)).strftime('%Y-%m-%d') <= value <= current.strftime('%Y-%m-%d')]
            if valid:
                return {'date': max(valid).replace('-', ''), 'status': 'verified',
                        'endpoint': 'stock_board_concept_hist_em', 'concept': row['name'],
                        'note': '板块日线末条日期；实时快照可能早于日线更新', 'errors': errors}
        except Exception as exc:
            errors.append(f'{type(exc).__name__}: {exc}')
    return {'date': '', 'status': 'unverified', 'errors': errors,
            'note': '实时接口未提供可核验日期，仅显示采集时间'}


def needs_refresh(data, now=None):
    now = now or datetime.now().astimezone()
    hot = data.get('hotspots') or {}
    if data.get('market_refresh_error') or hot.get('data_status') != 'akshare_ok':
        return True
    try:
        collected = datetime.fromisoformat(hot['collected_at'])
        return now - collected >= timedelta(minutes=30)
    except (KeyError, ValueError, TypeError):
        return True


def refresh_loop():
    """Run while the local server is alive; a stuck upstream cannot hang HTTP."""
    logs = ROOT / 'runs' / 'market_refresh'
    logs.mkdir(parents=True, exist_ok=True)
    while True:
        try:
            path = ROOT / 'web' / 'data' / 'site_data.json'
            data = json.loads(path.read_text(encoding='utf-8'))
            if needs_refresh(data):
                stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                with (logs / (stamp + '.log')).open('w', encoding='utf-8') as log:
                    subprocess.run([sys.executable, '-X', 'utf8', '-m', 'scripts.refresh_market_data_enhanced'],
                        cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=900, check=True,
                        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        except Exception as exc:
            print(f'Market refresh worker: {type(exc).__name__}: {exc}', flush=True)
        time.sleep(1800)
