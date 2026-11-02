"""Two-sheet export with the original 12-column mapping schema."""
from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill


def export_mapping(path, columns, primary, review, evidence, sourcing=None):
    from agent.topic_research import write_book
    groups = [('确定性高', columns, primary), ('待核验', columns, review)]
    write_book(path, groups)
    wb = load_workbook(path)
    if sourcing:
        ws = wb.create_sheet('检索执行')
        ws.append(['路径', '已执行', '搜索失败', '来源数', '搜索词', '来源编号'])
        for item in sourcing['coverage']:
            ws.append([item['name'], str(item['executed']), str(item['failed']), item['source_count'], item['query'], ', '.join(item['source_ids'])])
        ws.freeze_panes = 'B2'
        ws.auto_filter.ref = ws.dimensions
        for col in 'ABCDEF':
            ws.column_dimensions[col].width = 28 if col != 'E' else 65
        ws = wb.create_sheet('投资研究')
        from agent.sourcing_framework import INVESTMENT_FIELDS
        fields = ['公司名称'] + INVESTMENT_FIELDS + ['发现路径', '投资吸引力', '交易可行性', '优先级']
        ws.append(fields)
        by_name = {r['公司名称']: r for r in primary + review}
        for assessment in sourcing['companies']:
            row = {**by_name[assessment['公司名称']], **assessment}
            values = [str(row.get(f, '')) for f in fields]
            ws.append(["'" + v if v.startswith(('=', '+', '-', '@')) else v for v in values])
        ws.freeze_panes = 'B2'
        ws.auto_filter.ref = ws.dimensions
        from openpyxl.utils import get_column_letter
        for i in range(1, len(fields) + 1):
            ws.column_dimensions[get_column_letter(i)].width = 32
        for ws in (wb['检索执行'], wb['投资研究']):
            for cell in ws[1]:
                cell.fill = PatternFill('solid', fgColor='216A69')
                cell.font = Font(color='FFFFFF', bold=True)
            for row in ws.iter_rows(min_row=2):
                for cell in row:
                    cell.alignment = Alignment(wrap_text=True, vertical='top')
    for title, _, rows in groups:
        ws = wb[title]
        footer = len(rows) + 2
        ws.merge_cells(start_row=footer, start_column=1, end_row=footer, end_column=len(columns))
        cell = ws.cell(footer, 1)
        cell.value = '备注：本表依据公开信息生成，未知字段留空，确定性高不等同于已完成尽调，待核验项目不计入覆盖统计，来源与核验依据保留在研究任务记录中。'
        cell.font = Font(name='Microsoft YaHei', size=11, color='52616B')
        cell.fill = PatternFill('solid', fgColor='F0F5F5')
        cell.alignment = Alignment(vertical='center', wrap_text=True)
        ws.row_dimensions[footer].height = 32
    wb.save(path)
    wb.close()
