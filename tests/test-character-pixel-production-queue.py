import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('queue_builder',ROOT/'scripts/build-character-pixel-production-queue.py')
queue=importlib.util.module_from_spec(spec);spec.loader.exec_module(queue)

class FullRosterTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'docs/art/production/characters/appearance-refresh-v1'
        self.catalog=json.loads((base/'generated/catalog.json').read_text(encoding='utf-8'))
        self.policy=json.loads((base/'pixel-v2/policy.json').read_text(encoding='utf-8'))
    def test_all_real_entities_including_eggs_are_required(self):
        result=queue.build(self.catalog,self.policy)
        self.assertEqual(result['counts'],{'entities':224,'regular':216,'eggs':8,'packets':56,'redesignRequired':224,'defaultReplaced':0})
        self.assertEqual({r['entityId'] for r in result['records']},{e['entityId'] for e in self.catalog['entities']})
        self.assertTrue(all(r['redesignRequired'] and r['automaticDefaultReplacementRequested'] for r in result['records']))
        self.assertTrue(all(not r['runtimeEligible'] for r in result['records']))
    def test_owner_choices_and_first_complete_entity_preserved(self):
        records=queue.build(self.catalog,self.policy)['records']
        self.assertEqual([r['entityId'] for r in records[:8]],queue.PRIORITY)
        self.assertEqual([r['selectedConcept'] for r in records[:4]],['A','B','B','A'])
        self.assertEqual([r['selectedConcept'] for r in records[4:8]],['A','A','B','A'])
    def test_count_error_cannot_create_fictitious_entities(self):
        self.policy['verifiedEntityCount']=284
        with self.assertRaises(ValueError):queue.build(self.catalog,self.policy)
    def test_duplicate_source_identity_refused(self):
        self.catalog['entities'][1]=copy.deepcopy(self.catalog['entities'][0])
        with self.assertRaises(ValueError):queue.build(self.catalog,self.policy)

if __name__=='__main__':unittest.main()
