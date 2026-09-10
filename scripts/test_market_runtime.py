import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

from agent.market_runtime import needs_refresh, verify_market_date


class MarketRuntimeTests(unittest.TestCase):
    def test_legacy_snapshot_refreshes(self):
        self.assertTrue(needs_refresh({'hotspots': {'date': '20260814', 'data_status': 'akshare_ok'}}))

    def test_recent_snapshot_and_expiry(self):
        now = datetime.now(timezone.utc)
        data = {'hotspots': {'data_status': 'akshare_ok', 'collected_at': now.isoformat()}}
        self.assertFalse(needs_refresh(data, now))
        self.assertTrue(needs_refresh(data, now + timedelta(minutes=31)))
        data['market_refresh_error'] = {'message': 'failed'}
        self.assertTrue(needs_refresh(data, now))

    def test_unknown_source_date_never_becomes_today(self):
        ak = Mock()
        ak.stock_board_concept_hist_em.side_effect = RuntimeError('network unavailable')
        result = verify_market_date(ak, [{'name': 'test', 'board_code': 'BK1234'}])
        self.assertEqual(result['date'], '')
        self.assertEqual(result['status'], 'unverified')

    def test_source_date_uses_latest_returned_bar(self):
        from zoneinfo import ZoneInfo
        today = datetime.now(ZoneInfo('Asia/Shanghai')).date()
        yesterday = str(today - timedelta(days=1))
        ak = Mock()
        frame = {'日期': Mock()}
        frame['日期'].tolist.return_value = [yesterday]
        ak.stock_board_concept_hist_em.return_value = frame
        result = verify_market_date(ak, [{'name': 'test', 'board_code': 'BK1234'}])
        self.assertEqual(result['date'], yesterday.replace('-', ''))


if __name__ == '__main__':
    unittest.main()
