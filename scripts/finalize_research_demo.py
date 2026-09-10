"""Re-apply current export/quality rules to a completed live research run."""
import json
import sys
from agent import topic_research as research
from agent.research_quality import audit_rows
from agent.settings import load_config
from agent.research_export import export_mapping


def finalize(job_id):
    root = research.job_path(job_id)
    state = research.get_job(job_id)
    if state['status'] != 'completed':
        raise ValueError('Only completed live research can be finalized')
    result = json.loads((root / 'result.json').read_text(encoding='utf-8'))
    evidence = json.loads((root / 'evidence.json').read_text(encoding='utf-8'))
    if not (root / 'entity_merges.json').exists():
        from agent.research_entities import merge_aliases
        from agent.sources.research_glm import ResearchGLM
        rows, aliases = merge_aliases(result['primary'] + result['secondary'] + result['review'], evidence, ResearchGLM.from_config(load_config()))
        result['primary'] = [r for r in rows if r.get('上市状态') == '未上市']
        result['secondary'] = [r for r in rows if r.get('上市状态') == '已上市']
        result['review'] = [r for r in rows if r.get('上市状态') not in ('未上市','已上市')]
        research.save(root/'entity_merges.json', aliases)
    result['primary'], result['review'] = audit_rows(result['primary'], result['review'], evidence)
    headers = list(load_config()['mapping_columns'])
    for row in result['primary']:
        row['联系方式'] = ''
    errors = [json.loads(p.read_text(encoding='utf-8')) for p in (root/'raw').glob('extract_error_*.json')]
    sources = [{'编号': sid, '标题': s.get('title',''), '链接': s['link'], '发布时间': s.get('publish_date',''), '检索时间':s['retrieved_at'], '搜索词':s['query'], '证据内容':s.get('content','')} for sid,s in evidence.items()]
    notes = [{'项目':'研究主题','内容':state['topic']}, {'项目':'生成方式','内容':'实时智谱 Web Search + GLM 逐公司证据抽取。未读取导入文件或历史Mapping。'}, {'项目':'检索次数','内容':state['query_count']}, {'项目':'来源数量','内容':len(evidence)}, {'项目':'一级项目数量','内容':len(result['primary'])}, {'项目':'数量目标','内容':'15–30家；不为达标添加没有证据的公司。'}, {'项目':'覆盖范围','内容':result['plan'].get('scope','')}, {'项目':'覆盖边界','内容':'有限轮公开索引检索，不保证穷尽。不是实时工商核验。上市状态及事实对应来源时点。待核验主体未计入一级项目。'}, {'项目':'抽取失败','内容':errors}, {'项目':'模型','内容':load_config()['glm']['model']}]
    export_mapping(root/state['filename'], headers, result['primary'], result['review'], evidence)
    research.save(root/'result.json', result)
    research.save(root/'quality_report.json', {'rules':'stale-financing, group-ownership, valid-citations, 12-column-schema', 'primary':len(result['primary']), 'review':len(result['review']), 'extraction_errors':errors})
    count = len(result['primary'])
    research.update(job_id, primary_count=count, secondary_count=len(result['secondary']), review_count=len(result['review']), coverage_target_met=count>=15, preview=result['primary'][:10], message=f'已生成：确定性高 {count} 家，待核验 {len(result["review"])} 家')
    print(json.dumps({'job':job_id,'primary':count,'secondary':len(result['secondary']),'review':len(result['review']),'sources':len(evidence),'extraction_errors':len(errors)},ensure_ascii=False))


if __name__ == '__main__':
    finalize(sys.argv[1])
