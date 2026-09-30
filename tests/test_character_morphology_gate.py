import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('gate',Path(__file__).resolve().parents[1]/'scripts/character-morphology-gate.py')
G=importlib.util.module_from_spec(spec);spec.loader.exec_module(G)

class MorphologyGateTests(unittest.TestCase):
    def test_missing_receipt_cannot_be_bypassed_by_entity_id(self):
        with self.assertRaisesRegex(ValueError,'RECEIPT_REQUIRED'):
            G.validate(None,'m002_choromon','unused','unused')

    def test_approval_is_bound_to_art_and_all_semantic_checks(self):
        with tempfile.TemporaryDirectory() as d:
            d=Path(d);concept=d/'concept';inv=d/'inventory';receipt=d/'review.json'
            concept.write_bytes(b'original compact body');inv.write_bytes(b'fixed donor geometry')
            r={'status':'PASS_MORPHOLOGY_COMPATIBILITY','entityId':'test','reviewer':'test','reviewedAt':'test',
               'conceptSha256':hashlib.sha256(concept.read_bytes()).hexdigest(),
               'inventorySha256':hashlib.sha256(inv.read_bytes()).hexdigest(),
               'checks':{k:{'pass':True,'evidence':'test fixture only'} for k in G.CHECKS}}
            receipt.write_text(json.dumps(r));self.assertIn('sha256',G.validate(receipt,'test',concept,inv))
            r['checks']['limbsAndLocomotion']['pass']=False;receipt.write_text(json.dumps(r))
            with self.assertRaisesRegex(ValueError,'limbsAndLocomotion'):G.validate(receipt,'test',concept,inv)
            r['checks']['limbsAndLocomotion']['pass']=True;receipt.write_text(json.dumps(r));concept.write_bytes(b'tall bell')
            with self.assertRaisesRegex(ValueError,'INPUT_DRIFT'):G.validate(receipt,'test',concept,inv)

if __name__=='__main__':unittest.main()
