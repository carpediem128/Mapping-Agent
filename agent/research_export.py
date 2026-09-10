"""Two-sheet export with the original 12-column mapping schema."""
import json
from openpyxl import load_workbook
from openpyxl.comments import Comment


def export_mapping(path, columns, primary, review, evidence):
    from agent.topic_research import write_book
    groups = [('确定性高', columns, primary), ('待核验', columns, review)]
    write_book(path, groups)
    wb = load_workbook(path)
    for title, _, rows in groups:
        ws = wb[title]
        ws['A1'].comment = Comment(
            '本表由实时公开检索生成，未读取既有Mapping。确定性高表示已通过来源及主体筛选，不代表所有字段均已披露或完成尽调。待核验记录不计入一级市场覆盖统计。来源、发布时间及核验理由见公司名称单元格批注。未知字段留空。',
            'Mapping Agent')
        for index, row in enumerate(rows, 2):
            note = '\n'.join([str(row.get('核验状态', '')), '上市状态：' + str(row.get('上市状态', '待核验')),
                '信源时间：' + str(row.get('信源时间', '未提供')), '检索时间：' + str(row.get('检索时间', '')),
                '来源链接：\n' + str(row.get('信源链接', '')), '证据片段：\n' + str(row.get('证据片段', ''))])
            ws.cell(index, columns.index('公司名称') + 1).comment = Comment(note[:30000], 'Mapping Agent')
            try:
                citations = json.loads(row.get('字段证据', '{}'))
            except (ValueError, TypeError):
                citations = {}
            for col, field in enumerate(columns, 1):
                if field == '公司名称' or not row.get(field):
                    continue
                refs = [evidence[sid] for sid in citations.get(field, []) if sid in evidence]
                if refs:
                    ws.cell(index, col).comment = Comment('\n\n'.join(str(s.get('title', '')) + '\n' + s['link'] + '\n发布时间：' + str(s.get('publish_date') or '未提供') + '\n检索时间：' + str(s.get('retrieved_at', '')) for s in refs)[:30000], 'Mapping Agent')
    wb.save(path)
    wb.close()
