import copy
import datetime as dt
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('guard', Path(__file__).resolve().parents[1] / 'scripts/character-production-guard.py')
G = importlib.util.module_from_spec(spec)
spec.loader.exec_module(G)


class ProductionGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.now = dt.datetime.now(dt.timezone.utc)
        def artifact(name, value):
            p = self.root / name
            p.write_text(json.dumps(value), 'utf-8')
            return {'path': str(p), 'sha256': G.sha(p)}
        self.artifact = artifact
        key = 'main/cell_000'
        inv = artifact('inventory.json', {'slots': {key: {'canonical': key}, 'sub/cell_000': {'canonical': key}}})
        info = artifact('info.json', {'fixtureOnly': True})
        job = {'entityId': 'fixture', 'keys': [key], 'derived': {'main/cell_001': {'base': key}}, 'sourceOrigin': [32, 46],
               'inventory': inv, 'motionContract': info, 'selectedConcept': info, 'review': info}
        artifact('job.json', job)
        self.contract = {'entityId': 'fixture', 'jobSha256': G.sha(self.root / 'job.json'),
            'status': 'PASS_SOURCE_POSE_CONTRACT', 'originalSeedReviewedBy': 'TEST_ONLY', 'originalSeedReviewedAt': self.now.isoformat(),
            'originalSeed': info, 'sourceEvidence': info, 'cells': {key: {'route': 'MODEL_REQUIRED',
            'reviewedBy': 'TEST_ONLY', 'reviewedAt': self.now.isoformat(), 'canvasOrigin': [32, 46],
            'constraints': {'topology': 'fixture_biped', 'facing': 'left', 'bodyAxis': [0, -1],
                'expression': {'mouth': 'closed', 'eyes': 'open'}, 'restraint': 'none',
                'landmarks': {'bodyRoot': [0, 0]}, 'contacts': {'leftFoot': [-3, 0]}}}}}
        self.params = {'model': 'gpt_image_2_5', 'variant': 'flare', 'quality': 'high', 'resolution': '2k', 'count': 1, 'background': 'transparent'}
        self.policy = {**self.params, 'methodId': 'test', 'methodStatus': 'NOT_PROVEN', 'methodEvidence': None,
            'maximumQuotedImageCost': '2.75', 'maxQuoteAgeSeconds': 900, 'maxInFlight': 6,
            'maxAttemptsPerCanonicalPerMethod': 2, 'calibrationMaxTargetsPerImage': 4,
            'productionMaxTargetsPerImage': 16, 'initialCredits': '10', 'buckets': {'calibration': '5.5', 'future': '4.5'}}
        self.request = {'jobDirectory': str(self.root), 'methodId': 'test', 'bucket': 'calibration',
            'params': self.params.copy(), 'patchKeys': [key], 'poseContract': artifact('pose.json', self.contract),
            'quote': artifact('quote.json', {'source': 'HIGGSFIELD_ESTIMATE_IMAGE_COST', 'capturedAt': self.now.isoformat(), 'params': self.params, 'credits': '2.75'}),
            'balance': artifact('balance.json', {'source': 'HIGGSFIELD_BALANCE', 'capturedAt': self.now.isoformat(), 'credits': '10'})}
        self.pp = self.root / 'policy.json'; artifact('policy.json', self.policy)
        self.sp = self.root / 'state.json'
        self.state = {'policySha256': G.sha(self.pp), 'reservations': []}
        artifact('state.json', self.state)
        self.rp = self.root / 'request.json'; artifact('request.json', self.request)

    def check(self, request=None, state=None):
        return G.check_request(self.policy, self.state if state is None else state, self.request if request is None else request, self.now)

    def test_reviewed_calibration_has_fixed_cost_but_no_art_approval(self):
        row = self.check()
        self.assertEqual(row['reservedCredits'], '2.75')
        self.assertNotIn('artAccepted', row)
        self.assertEqual(self.state['reservations'], [])

    def test_max_quality_cannot_silently_consume_more_credits(self):
        self.request['params']['quality'] = 'max'
        with self.assertRaisesRegex(ValueError, 'DISALLOWED_GENERATION_SETTING_quality'): self.check()

    def test_production_blocked_before_representative_proof(self):
        self.request['bucket'] = 'future'
        with self.assertRaisesRegex(ValueError, 'METHOD_NOT_PROVEN'): self.check()

    def test_green_summary_cannot_override_failed_visual_evidence(self):
        info = self.artifact('fake-bank.json', {'fixtureOnly': True})
        visual = self.artifact('failed-visual.json', {'status': 'NEEDS_REPAIR', 'unresolved': ['wrong facing']})
        rendering = self.artifact('renderer.json', {'complete': True, 'failures': []})
        cert = {'methodId': 'test', 'status': 'PASS_REPRESENTATIVE_NATIVE_AND_GAME_QA',
                'records': [{'entityId': str(i), 'bank': info, 'visualReview': visual, 'rendererReview': rendering,
                'checks': {k: True for k in ('pose', 'expression', 'restraint', 'contact', 'identity', 'sequence', 'nativeAnd4x8x')}} for i in range(6)]}
        self.policy['methodStatus'] = 'PROVEN_REPRESENTATIVE_SET'
        self.policy['methodEvidence'] = self.artifact('cert.json', cert)
        self.request['bucket'] = 'future'
        with self.assertRaisesRegex(ValueError, 'VISUAL_EVIDENCE_NOT_PASSED'): self.check()

    def test_same_as_cell_cannot_become_paid_work(self):
        job = G.read(self.root / 'job.json'); job['keys'].append('sub/cell_000')
        self.artifact('job.json', job)
        self.contract['jobSha256'] = G.sha(self.root / 'job.json')
        self.request['poseContract'] = self.artifact('pose.json', self.contract)
        self.request['patchKeys'] = ['sub/cell_000']
        with self.assertRaisesRegex(ValueError, 'ALIAS_MUST_NOT_BE_GENERATED'): self.check()

    def test_unknown_pose_and_wrong_origin_fail_closed(self):
        self.contract['cells']['main/cell_000']['constraints']['facing'] = None
        self.request['poseContract'] = self.artifact('pose.json', self.contract)
        with self.assertRaisesRegex(ValueError, 'EXPLICIT_POSE_CONSTRAINTS'): self.check()
        self.contract['cells']['main/cell_000']['constraints']['facing'] = 'left'
        self.contract['cells']['main/cell_000']['canvasOrigin'] = [31, 46]
        self.request['poseContract'] = self.artifact('pose.json', self.contract)
        with self.assertRaisesRegex(ValueError, 'ORIGIN_DRIFT'): self.check()

    def test_landmark_prose_is_not_native_pixel_coordinates(self):
        self.contract['cells']['main/cell_000']['constraints']['landmarks'] = {'foot': 'looks aligned'}
        self.request['poseContract'] = self.artifact('pose.json', self.contract)
        with self.assertRaisesRegex(ValueError, 'ANATOMICAL_LANDMARK_COORDINATES_REQUIRED'): self.check()

    def test_airborne_pose_may_have_no_ground_contact_when_explicit(self):
        constraints = self.contract['cells']['main/cell_000']['constraints']
        constraints['contacts'] = {}
        self.request['poseContract'] = self.artifact('pose.json', self.contract)
        with self.assertRaisesRegex(ValueError, 'EMPTY_CONTACTS_REQUIRE_SOURCE_EXPLANATION'): self.check()
        constraints['contactState'] = 'airborne'
        self.request['poseContract'] = self.artifact('pose.json', self.contract)
        self.assertEqual(self.check()['status'], 'reserved')

    def test_special_state_and_duplicate_targets_never_charge(self):
        self.request['patchKeys'] = ['main/cell_001']
        with self.assertRaisesRegex(ValueError, 'DETERMINISTIC_OR_UNKNOWN'): self.check()
        self.request['patchKeys'] = ['main/cell_000', 'main/cell_000']
        with self.assertRaisesRegex(ValueError, 'DUPLICATE_OR_EMPTY'): self.check()

    def test_unknown_submissions_hold_budget_and_prevent_duplicate(self):
        row = self.check(); row['status'] = 'unknown'; self.state['reservations'] = [row]
        with self.assertRaisesRegex(ValueError, 'DUPLICATE_REQUEST'): self.check()
        self.request['params']['prompt'] = 'different request'
        with self.assertRaisesRegex(ValueError, 'IN_FLIGHT_LIMIT'): self.check()

    def test_completed_requests_count_towards_retry_and_budget(self):
        row = self.check(); row['status'] = 'completed'; row['fingerprint'] = 'previous'
        other = copy.deepcopy(row); other['fingerprint'] = 'older'
        self.state['reservations'] = [row, other]
        with self.assertRaisesRegex(ValueError, 'POSE_RETRY_LIMIT'): self.check()
        other['entityId'] = 'different_entity'
        with self.assertRaisesRegex(ValueError, 'BUCKET_EXHAUSTED'): self.check()

    def test_stale_quote_and_changed_seed_fail(self):
        self.now += dt.timedelta(seconds=901)
        with self.assertRaisesRegex(ValueError, 'STALE_PROVIDER'): self.check()
        self.now -= dt.timedelta(seconds=901)
        (self.root / 'info.json').write_text('modified')
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_HASH_DRIFT'): self.check()

    def test_atomic_reservation_duplicate_and_locked_state(self):
        first = G.reserve(self.pp, self.sp, self.rp)
        self.assertEqual(len(G.read(self.sp)['reservations']), 1)
        with self.assertRaisesRegex(ValueError, 'DUPLICATE_REQUEST'): G.reserve(self.pp, self.sp, self.rp)
        lock = self.sp.with_suffix('.json.lock'); lock.write_text('another process')
        with self.assertRaisesRegex(ValueError, 'BUDGET_BUSY'): G.reserve(self.pp, self.sp, self.rp)
        self.assertTrue(lock.exists()); lock.unlink()
        proof = self.artifact('unknown.json', {'fingerprint': first['fingerprint'], 'status': 'unknown'})
        G.record_result(self.pp, self.sp, first['fingerprint'], 'unknown', proof)
        cancel = self.artifact('cancel.json', {'fingerprint': first['fingerprint'], 'status': 'cancelled_before_submit', 'providerInvoked': False})
        with self.assertRaisesRegex(ValueError, 'INVALID_RESULT_TRANSITION'):
            G.record_result(self.pp, self.sp, first['fingerprint'], 'cancelled_before_submit', cancel)
        self.assertEqual(G.read(self.sp)['reservations'][0]['reservedCredits'], '2.75')


if __name__ == '__main__':
    unittest.main()
