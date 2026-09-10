"""Deterministic checks applied after evidence extraction, before publication."""
import json
import re
from datetime import datetime


def audit_rows(primary, review, evidence):
    accepted = []
    for row in primary:
        reasons = []
        citations = row.get('字段证据', '{}')
        try:
            citations = json.loads(citations)
        except (ValueError, TypeError):
            citations = {}
        ids = citations.get('上市状态', [])
        sources = [evidence[sid] for sid in ids if sid in evidence]
        content = '\n'.join(s.get('content', '') for s in sources)
        financing = str(row.get('融资时间', ''))
        years = [int(v) for v in re.findall(r'(?<!\d)(?:19|20)\d{2}(?!\d)', financing)]
        if years and max(years) < datetime.now().year - 2:
            reasons.append('融资证据超过两年，需补查当前上市及存续状态')
        if re.search(r'parent companies|wholly.owned subsidiary|上市公司子公司|全资子公司', content, re.I):
            reasons.append('可能属于上市集团，需确认独立融资主体')
        if not sources:
            reasons.append('缺少上市状态证据')
        name = row.get('公司名称', '')
        tokens = [name.lower()]
        tokens += [t.lower() for t in re.findall(r'[A-Za-z]{5,}', name) if t.lower() not in ('technologies','technology','limited','company','solutions')]
        for part in re.findall(r'[\u4e00-\u9fff]+', name):
            tokens += [part[i:i+4] for i in range(max(0, len(part)-3)) if part[i:i+4] not in ('科技有限','有限公司','股份有限','半导体科')]
        dedicated = any(any(t and t in (s.get('title','') + ' ' + s.get('link','')).lower() for t in tokens) for s in sources)
        if not dedicated:
            reasons.append('仅有泛行业材料，缺少可识别的企业独立报道或官网证据')
        if reasons:
            row['上市状态'] = '待核验'
            row['核验状态'] = '；'.join(reasons)
            review.append(row)
        else:
            accepted.append(row)
    return accepted, review
