import unittest
from agent.sourcing_framework import enrich_plan


class SourcingFrameworkTest(unittest.TestCase):
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
