import unittest
import tempfile
from pathlib import Path
from openpyxl import load_workbook
from agent.sourcing_framework import enrich_plan
from agent.sourcing_framework import execution_report


class SourcingFrameworkTest(unittest.TestCase):
    def test_candidate_budget_is_shared_by_paths(self):
        from agent.sourcing_framework import select_candidates
        plan = enrich_plan('光芯片', {})
        paths = plan['discovery_paths']
        evidence = {'S1': {'query': paths[0]['query']}, 'S2': {'query': paths[1]['query']}}
        candidates = [{'name': 'A', 'source_ids': ['S1']}, {'name': 'B', 'source_ids': ['S1']},
                      {'name': 'C', 'source_ids': ['S2']}, {'name': '伪引用', 'source_ids': ['missing']}]
        self.assertEqual(select_candidates(candidates, evidence, plan, limit=2), ['A', 'C'])

    def test_export_contains_executed_paths_and_investment_fields(self):
        from agent.research_export import export_mapping
        plan = enrich_plan('光芯片', {})
        queries = [p['query'] for p in plan['discovery_paths']]
        evidence = {'S1': {'query': queries[0], 'queries': queries[:2]}}
        row = {'公司名称': '示例', '技术路线': 'TFLN', '字段证据': '{"公司名称":["S1"],"技术路线":["S1"]}'}
        report = execution_report(plan, evidence, queries, [], [row])
        self.assertTrue(report['all_paths_executed'])
        self.assertEqual(report['companies'][0]['发现路径'], ['BOM价值量', '技术路线'])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'result.xlsx'
            export_mapping(path, ['公司名称'], [row], [], evidence, sourcing=report)
            book = load_workbook(path)
            self.assertEqual(book.sheetnames, ['确定性高', '待核验', '检索执行', '投资研究'])
            self.assertEqual(book['检索执行'].max_row, 13)
            headers = [c.value for c in book['投资研究'][1]]
            self.assertEqual(book['投资研究'].cell(2, headers.index('技术路线') + 1).value, 'TFLN')
            book.close()

    def test_execution_audit_does_not_claim_unsearched_paths(self):
        plan = enrich_plan('光芯片', {})
        query = plan['discovery_paths'][0]['query']
        evidence = {'S1': {'query': query, 'queries': [query]}}
        report = execution_report(plan, evidence, [query], [], [
            {'公司名称': '测试企业', '字段证据': '{"公司名称":["S1"]}'}])
        self.assertFalse(report['all_paths_executed'])
        self.assertEqual(report['coverage'][0]['source_count'], 1)
        self.assertEqual(report['companies'][0]['发现路径'], ['BOM价值量'])
        self.assertEqual(report['companies'][0]['交易可行性'], '待判断')
        self.assertEqual(len(report['uncovered_paths']), 11)

    def test_paths_and_priorities(self):
        original = {'scope': 'test', 'queries': ['original']}
        plan = enrich_plan('光芯片', original)
        paths = plan['discovery_paths']
        self.assertEqual(len(paths), 12)
        self.assertEqual(len({p['id'] for p in paths}), 12)
        self.assertEqual(sum(p['priority'] for p in paths), 6)
        self.assertTrue(all(p['query'].startswith('光芯片 ') for p in paths))
        self.assertNotIn('discovery_paths', original)
        self.assertEqual(plan['queries'], ['original'])
        self.assertIn('待判断', plan['screening']['policy'])


if __name__ == '__main__':
    unittest.main()
