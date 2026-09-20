"""Negative coverage and approval boundaries for the offline work packet."""
import copy
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('workpack', ROOT / 'scripts/prepare-character-workpack.py')
W = importlib.util.module_from_spec(spec)
spec.loader.exec_module(W)


class WorkpackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan = W.P.read(W.P.WORK / 'generated/preflight.json')
        cls.contract = W.P.read(ROOT / cls.plan['motionContractPath'])
        cls.setting = W.P.read(W.P.PACK / 'pixel-v2/settings' / W.P.ENTITY / 'setting.json')

    def packet(self):
        import json
        return {k: json.loads(v) for k, v in W.make_files(self.plan, self.contract, self.setting).items()
                if k.endswith('.json')}

    def test_all_slots_and_repeated_timing_references_preserved(self):
        refs = W.references(self.contract)
        self.assertEqual(set(refs), set(self.plan['slots']))
        actual = sum(len(r) for r in refs.values())
        expected = sum(len(s['frames']) for b in self.contract['sides'].values() for s in b['sequences'])
        self.assertEqual(actual, expected)
        repeated = copy.deepcopy(self.contract)
        sequence = copy.deepcopy(repeated['sides']['main']['sequences'][0])
        sequence['id'] = 999
        sequence['frames'][0]['ticks'] = 3
        repeated['sides']['main']['sequences'].append(sequence)
        extra = W.references(repeated)['main/cell_000']
        self.assertEqual(len(extra), len(refs['main/cell_000']) + 1)
        self.assertEqual(extra[-1]['ticks'], 3)

    def test_missing_duplicate_and_hash_changed_reviews_rejected(self):
        rows = self.packet()['cell-review.json']['rows']
        bad_hash = copy.deepcopy(rows)
        bad_hash[0]['sourceRgbaSha256'] = 'changed'
        for bad in (rows[:-1], rows + [rows[0]], bad_hash):
            with self.assertRaises(ValueError):
                W.validate_reviews(bad, self.plan['slots'])

    def test_acceptance_requires_output_all_checks_and_evidence(self):
        rows = self.packet()['cell-review.json']['rows']
        rows[0]['productionStatus'] = 'ACCEPTED'
        rows[0]['outputSha256'] = 'candidate'
        with self.assertRaisesRegex(ValueError, 'INCOMPLETE_VISUAL_REVIEW'):
            W.validate_reviews(rows, self.plan['slots'])
        rows[0]['checks']['mouth']['status'] = 'PASS'
        with self.assertRaisesRegex(ValueError, 'REVIEW_EVIDENCE_REQUIRED'):
            W.validate_reviews(rows, self.plan['slots'])

    def test_expression_pair_separate_jobs_no_paid_or_runtime_promotion(self):
        data = self.packet()
        queue = data['queue.json']
        self.assertEqual(len(queue['jobs']), 2)
        self.assertEqual(len({j['cacheKey'] for j in queue['jobs']}), 2)
        self.assertEqual(queue['creditsAuthorized'], 0)
        self.assertFalse(queue['nextEntityAllowed'])
        self.assertFalse(queue['runtimeEligible'])
        for job in queue['jobs']:
            self.assertFalse(data[job['request']]['submissionAllowed'])
            self.assertEqual(data[job['request']]['automaticRetries'], 0)

    def test_motion_drift_refused(self):
        modified = copy.deepcopy(self.contract)
        modified['sides']['main']['sequences'][0]['frames'][0]['ticks'] += 1
        with self.assertRaisesRegex(ValueError, 'MOTION_CONTRACT_DRIFT'):
            W.make_files(self.plan, modified, self.setting)


if __name__ == '__main__':
    unittest.main()
