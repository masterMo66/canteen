from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from import_menus import columns_for_dates, discover, period


class MenuDatesTest(unittest.TestCase):
    def test_makeup_sunday(self):
        start, end = period('菜单9.20-9.24.xlsx', 2026)
        self.assertEqual(columns_for_dates(['种类', '周日', '周一', '周二', '周三', '周四'], start, end),
                         {1: '2026-09-20', 2: '2026-09-21', 3: '2026-09-22', 4: '2026-09-23', 5: '2026-09-24'})

    def test_conflicting_explicit_header(self):
        with self.assertRaises(ValueError):
            columns_for_dates(['星期一（9月20日）'], date(2026, 9, 20), date(2026, 9, 24))

    def test_takeout_starts_monday(self):
        columns = columns_for_dates(['周一', '周二', '周三', '周四'], *period('外卖9.21-9.24', 2026))
        self.assertNotIn('2026-09-20', columns.values())

    def test_cross_year(self):
        self.assertEqual(period('12.28-1.1', 2026), (date(2026, 12, 28), date(2027, 1, 1)))

    def test_discovery_month_rollover_and_incomplete_pair(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            folder = root / '2026-12'
            folder.mkdir()
            for filename in ('黄山大厦1楼周菜单1.4-1.8.xls', '蜀王餐厅一周菜单1.4-1.8.xlsx'):
                (folder / filename).touch()
            found = discover(root, date(2027, 1, 4))
            self.assertEqual(found['shuwang'][4], 2027)
            with self.assertRaises(ValueError):
                discover(root, date(2027, 1, 3))
            folder = root / '2027-01'
            folder.mkdir()
            (folder / '蜀王餐厅一周菜单1.11-1.15.xlsx').touch()
            with self.assertRaises(ValueError):
                discover(root, date(2027, 1, 11))


if __name__ == '__main__':
    unittest.main()
