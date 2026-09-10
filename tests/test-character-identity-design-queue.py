import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('identity_queue',ROOT/'scripts/build-character-identity-design-queue.py')
q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)

class IdentityQueueTests(unittest.TestCase):
    def fixture(self):
        sources=[{'entityId':f'entity-{i}','sourceImageSha256':str(i)} for i in range(224)]
        records=[{**s,'chosenFamily':'FELINE','sourceVisualReviewed':True,'artStatus':'BRIEF_ONLY_NOT_DRAWN',
                  'observedBody':'two-foot body','designName':f'cat-{i}','rationale':'source limbs fit','risk':'mouth endpoint',
                  'fixedTraits':['triangle ears','cream cheeks','short nose'],'changedRegions':['head'],
                  'preservedMotion':['feet'],'allowedContourChanges':[]} for i,s in enumerate(sources)]
        return records,sources

    def test_all_actual_entities_required_once(self):
        records,sources=self.fixture();q.validate_briefs(records,sources)
        for invalid in [records[:-1],records+records[:1],records[:-1]+records[:1]]:
            with self.assertRaises(ValueError):q.validate_briefs(invalid,sources)

    def test_execution_projection_cannot_drop_or_duplicate_an_entity(self):
        _,sources=self.fixture();q.validate_execution_queue(sources,sources)
        for invalid in [sources[:-1],sources+sources[:1],sources[:-1]+sources[:1]]:
            with self.assertRaises(ValueError):q.validate_execution_queue(invalid,sources)

    def test_stale_or_unseen_reference_rejected(self):
        for field,value in [('sourceImageSha256','wrong'),('sourceVisualReviewed',False)]:
            records,sources=self.fixture();records[0][field]=value
            with self.assertRaises(ValueError):q.validate_briefs(records,sources)

    def test_brief_cannot_claim_drawing_completion(self):
        records,sources=self.fixture();records[0]['artStatus']='ALL_ART_COMPLETE'
        with self.assertRaises(ValueError):q.validate_briefs(records,sources)

    def test_concrete_rules_required(self):
        for field,value in [('chosenFamily','UNKNOWN'),('fixedTraits',['same']*3),('rationale',''),('preservedMotion',[]),('allowedContourChanges',None)]:
            records,sources=self.fixture();records[0][field]=value
            with self.assertRaises(ValueError):q.validate_briefs(records,sources)

if __name__=='__main__':unittest.main()
