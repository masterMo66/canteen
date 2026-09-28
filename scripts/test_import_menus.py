from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import hashlib
import json
from unittest.mock import patch

from import_menus import columns_for_dates, discover, period, parse_workbook, fast_check


class MenuDatesTest(unittest.TestCase):
    def test_fast_check_detects_replacement_and_expired_coverage(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'src').mkdir()
            (root / 'src/menuData.ts').write_text('data')
            workbook = root / 'menu.xls'
            workbook.write_bytes(b'original')
            manifest = {'sources': [{'restaurant': 'huangshan-1f', 'filename': workbook.name,
                                     'sha256': hashlib.sha256(b'original').hexdigest()}]}
            (root / 'src/menuSources.json').write_text(json.dumps(manifest))
            latest = {'huangshan-1f': (date(2026, 9, 28), date(2026, 9, 30), 0, workbook, 2026)}
            cache = root / 'cache.json'
            with patch('import_menus.ROOT', root):
                self.assertFalse(fast_check(latest, date(2026, 9, 28), cache)['changed'])
                self.assertTrue(fast_check(latest, date(2026, 9, 29), cache)['metadata_cache_hit'])
                self.assertFalse(fast_check(latest, date(2026, 10, 1), cache)['covers_today'])
                workbook.write_bytes(b'new workbook')
                self.assertTrue(fast_check(latest, date(2026, 9, 29), cache)['changed'])

    def test_renamed_first_floor_menu(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            folder = root / '2026-09'
            folder.mkdir()
            for filename in ('黄山大厦 总行餐厅 1楼周菜单9.20-9.24.xls',
                             '黄山大厦1楼 新菜单9.28-9.30.xls',
                             '蜀王餐厅一周菜单9.28-9.30.xlsx',
                             '黄山大厦2楼 新菜单9.28-9.30.xls'):
                (folder / filename).touch()
            found = discover(root, date(2026, 9, 28))
            self.assertEqual(found['huangshan-1f'][3].name, '黄山大厦1楼 新菜单9.28-9.30.xls')

    def test_merged_tuesday_breakfast_announcement(self):
        sheets = [
            ('二楼早餐菜单', [['早餐9.28-9.30', '', '', ''], ['种类', '周一', '周二', '周三'],
             ['蒸', '包子', '包子', '包子'], ['早餐新增', '本周二推出沙汤/锅贴\n温馨提示：按需取餐', '', ''],
             ['', '', '', '']], [(3, 5, 0, 1), (3, 5, 1, 4)]),
            ('二楼午餐菜单', [['菜单9.28-9.30', '', '', '', ''], ['种类', '种类', '周一', '周二', '周三'],
             ['午餐', '主食', '饭', '饭', '饭'], ['晚餐', '主食', '面', '面', '面']], []),
            ('三楼菜单', [['菜单9.28-9.30', '', '', ''], ['种类', '周一', '周二', '周三'], ['热菜', '菜', '菜', '菜']], []),
        ]
        with patch('import_menus.load_sheets', return_value=sheets):
            parsed = parse_workbook(Path('蜀王餐厅一周菜单9.28-9.30.xlsx'), 2026)
        self.assertEqual(parsed['2026-09-29']['早餐']['早餐新增'], ['沙汤', '锅贴'])
        self.assertNotIn('早餐新增', parsed['2026-09-28']['早餐'])
        self.assertNotIn('早餐新增', parsed['2026-09-30']['早餐'])

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
