"""Import the two local WeChat menu workbooks; never uploads source workbooks."""
import argparse
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.local-python'))
WEEKDAYS = '一二三四五六日'


def text(value):
    return '' if value is None else str(value).strip()


def period(value, year):
    match = re.search(r'(\d{1,2})[.月](\d{1,2})日?\s*[-—~至]\s*(\d{1,2})[.月](\d{1,2})', value)
    if not match:
        raise ValueError(f'无法识别日期范围: {value}')
    m1, d1, m2, d2 = map(int, match.groups())
    start, end = date(year, m1, d1), date(year + (m2 < m1), m2, d2)
    if not 0 <= (end - start).days <= 13:
        raise ValueError(f'菜单周期异常: {value}')
    return start, end


def load_sheets(path):
    if path.suffix.lower() == '.xls':
        import xlrd
        book = xlrd.open_workbook(str(path), formatting_info=True)
        return [(s.name, [[text(v) for v in s.row_values(r)] for r in range(s.nrows)],
                 s.merged_cells) for s in book.sheets()]
    import openpyxl
    book = openpyxl.load_workbook(path, data_only=True)
    return [(s.title, [[text(v) for v in row] for row in s.values],
             [(r.min_row - 1, r.max_row, r.min_col - 1, r.max_col) for r in s.merged_cells.ranges])
            for s in book]


def columns_for_dates(headers, start, end):
    columns = {}
    for col, header in enumerate(headers):
        match = re.search(r'(?:星期|周)([一二三四五六日天])', header)
        if not match:
            continue
        weekday = WEEKDAYS.index(match[1].replace('天', '日'))
        explicit = re.search(r'(\d+)月(\d+)日', header)
        candidates = [start + timedelta(days=i) for i in range((end - start).days + 1)
                      if (start + timedelta(days=i)).weekday() == weekday]
        if explicit:
            candidates = [d for d in candidates if (d.month, d.day) == tuple(map(int, explicit.groups()))]
        if len(candidates) != 1:
            raise ValueError(f'日期和星期不一致或不唯一: {header}')
        columns[col] = candidates[0].isoformat()
    if not columns or len(set(columns.values())) != len(columns):
        raise ValueError('日期表头缺失或重复')
    return columns


def parse_workbook(path, year):
    start, end = period(path.name, year)
    result = {}
    for name, rows, merges in load_sheets(path):
        if len(rows) < 3:
            raise ValueError(f'空工作表: {name}')
        try:
            sheet_start, sheet_end = period(rows[0][0], year)
        except ValueError:
            sheet_start, sheet_end = start, end
        if sheet_start < start or sheet_end > end:
            raise ValueError(f'工作表日期超出文件周期: {name}')
        columns = columns_for_dates(rows[1], sheet_start, sheet_end)
        takeout = '外卖' in name
        breakfast = '早餐' in name
        third = '三楼' in name
        if not (takeout or breakfast or third or '午餐' in name):
            raise ValueError(f'未识别的工作表: {name}')
        first_col = min(columns)
        # Fill merged labels only. Dish cells spanning rows are counted once.
        for r0, r1, c0, c1 in merges:
            if c1 <= first_col:
                for r in range(r0, r1):
                    for c in range(c0, c1):
                        rows[r][c] = rows[r0][c0]
        meal_name = '外卖' if takeout else '早餐' if breakfast else '三楼餐区' if third else '午餐'
        category = '外卖' if takeout else ''
        for row_index, row in enumerate(rows[2:], start=2):
            # Skip explanatory rows spanning the date columns, including salad descriptions.
            if any(r0 <= row_index < r1 and c1 - c0 > 1 and c1 > first_col
                   for r0, r1, c0, c1 in merges):
                continue
            if not takeout and not breakfast and not third:
                label = row[0].replace('中餐', '午餐')
                if label in ('午餐', '晚餐'):
                    meal_name = label
                category = row[first_col - 1] or category
            elif not takeout:
                category = row[first_col - 1] or category
            for col, day in columns.items():
                value = row[col] if col < len(row) else ''
                if not value:
                    continue
                if not category:
                    raise ValueError(f'菜品缺少分类: {name}:{row_index + 1}')
                # Preserve parenthetical prices, descriptions and wrapped dish names.
                value = re.sub(r'\s+', ' ', value).strip()
                meals = result.setdefault(day, {})
                sections = meals.setdefault(meal_name, {})
                sections.setdefault(re.sub(r'\s+', ' ', category), []).append(value)
    expected = {(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)}
    if not set(result).issubset(expected):
        raise ValueError('菜单日期越界')
    for day, meals in result.items():
        for required in ('早餐', '午餐', '晚餐'):
            if not meals.get(required):
                raise ValueError(f'{path.name}: {day} 缺少{required}')
        if path.name.startswith('蜀王') and not meals.get('三楼餐区'):
            raise ValueError(f'{day} 缺少三楼菜单')
    return result


def discover(root, today):
    found = {'huangshan-1f': [], 'shuwang': []}
    # Scan dated month directories, including previous months and December/January boundaries.
    for directory in root.iterdir():
        if not directory.is_dir() or not re.fullmatch(r'\d{4}-\d{2}', directory.name):
            continue
        for path in directory.iterdir():
            if path.suffix.lower() not in ('.xls', '.xlsx') or path.name.startswith('~$'):
                continue
            key = 'huangshan-1f' if '黄山大厦' in path.name and '1楼周菜单' in path.name else 'shuwang' if '蜀王餐厅一周菜单' in path.name else None
            if not key:
                continue
            folder_year, folder_month = map(int, directory.name.split('-'))
            menu_month = int(re.search(r'(\d{1,2})[.月]\d{1,2}', path.name)[1])
            year = folder_year + (folder_month == 12 and menu_month == 1) - (folder_month == 1 and menu_month == 12)
            start, end = period(path.name, year)
            if start > today or end < today - timedelta(days=21):
                continue
            found[key].append((start, end, path.stat().st_mtime_ns, path, year))
    if not all(found.values()):
        raise ValueError('未找到两家餐厅最近的菜单文件，请确认微信已下载附件')
    latest = {key: max(values, key=lambda v: (v[0], v[1], v[2])) for key, values in found.items()}
    if latest['huangshan-1f'][:2] != latest['shuwang'][:2]:
        raise ValueError('两家餐厅的最新菜单周期不一致，等待另一份文件，保留现有数据')
    return latest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, required=True, help='WeChat msg/file directory, without month')
    parser.add_argument('--today', type=date.fromisoformat, default=datetime.now(timezone(timedelta(hours=8))).date())
    parser.add_argument('--check', action='store_true', help='Validate without writing')
    args = parser.parse_args()
    latest = discover(args.source_root, args.today)
    parsed = {key: parse_workbook(info[3], info[4]) for key, info in latest.items()}
    if set(parsed['huangshan-1f']) != set(parsed['shuwang']):
        raise ValueError('两家餐厅的供餐日期不一致')
    days = []
    for key in sorted(parsed['huangshan-1f']):
        d = date.fromisoformat(key)
        restaurants = []
        for rid, menus in parsed.items():
            first = rid == 'huangshan-1f'
            meals = []
            for name, sections in menus[key].items():
                # Put separately listed takeout into the dinner view, matching pickup time.
                time = '三楼简餐' if name == '三楼餐区' else '晚餐外卖' if name == '外卖' else name
                meals.append({'name': name, 'time': time, 'sections': [
                    {'title': title, 'items': items} for title, items in sections.items()]})
            restaurants.append({'id': rid, 'name': '黄山大厦 总行餐厅 1楼' if first else '蜀王餐厅',
                'shortName': '黄山大厦 1F' if first else '蜀王 2F / 3F',
                'location': '总行餐厅一楼' if first else '二楼、三楼餐区',
                'source': latest[rid][3].name, 'meals': meals})
        days.append({'date': key, 'weekday': '星期' + WEEKDAYS[d.weekday()],
                     'shortWeekday': '周' + WEEKDAYS[d.weekday()], 'label': f'{d.month}月{d.day}日', 'restaurants': restaurants})
    target = ROOT / 'src/menuData.ts'
    old = target.read_text(encoding='utf-8')
    old_start = re.search(r"export const menuRange = '(\d{4}-\d{2}-\d{2})", old)
    if old_start and days[0]['date'] < old_start[1]:
        raise ValueError('拒绝用旧周期覆盖已发布菜单')
    types = old.split('export const menuRange')[0]
    content = types + f"export const menuRange = '{days[0]['date']} 至 {days[-1]['date']}'\n\n"
    content += 'export const menuDays = ' + json.dumps(days, ensure_ascii=False, indent=2) + ' satisfies MenuDay[]\n'
    manifest = {'range': [days[0]['date'], days[-1]['date']], 'sources': [
        {'restaurant': rid, 'filename': info[3].name, 'sha256': hashlib.sha256(info[3].read_bytes()).hexdigest()}
        for rid, info in latest.items()]}
    changed = content != old
    if not args.check:
        target.write_text(content, encoding='utf-8')
        (ROOT / 'src/menuSources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'changed': changed, 'check': args.check, 'days': [d['date'] for d in days], 'sources': manifest['sources']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
