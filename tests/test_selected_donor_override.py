"""A later review cannot approve another entity or silently changed evidence."""
import importlib.util, json, tempfile, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare_review_gate', ROOT/'scripts/prepare-selected-character-sheet.py')
P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)

class DonorReviewGate(unittest.TestCase):
    def test_frozen_record_retained_and_new_review_bound(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'review.json'
            record={'entityId':'m106_nyaromon','donorInventory':{'sha256':'inventory'},'donorReview':{'path':'frozen'}}
            review={'entityId':record['entityId'],'inventorySha256':'inventory','status':'PASS_DONOR_REVIEW','unresolvedBlockingIssues':[]}
            p.write_text(json.dumps(review))
            config={'reviewedDonorOverride':{'path':str(p),'sha256':P.S.sha(p)},'donorReviewOverrideReason':'Actual visual audit completed'}
            result=P.reviewed_donor_record(record,config)
            self.assertEqual(record['donorReview']['path'],'frozen')
            self.assertEqual(result['donorReview'],config['reviewedDonorOverride'])
            for key,value,message in [('entityId','wrong','REVIEW_ENTITY_MISMATCH'),('inventorySha256','wrong','REVIEW_INVENTORY_MISMATCH'),('status','PENDING','REVIEW_NOT_COMPLETE'),('unresolvedBlockingIssues',['unknown pose'],'REVIEW_NOT_COMPLETE')]:
                with self.subTest(key=key):
                    p.write_text(json.dumps({**review,key:value}));config['reviewedDonorOverride']['sha256']=P.S.sha(p)
                    with self.assertRaisesRegex(Exception,message):P.reviewed_donor_record(record,config)
            p.write_text(json.dumps(review));config['reviewedDonorOverride']['sha256']='stale'
            with self.assertRaisesRegex(Exception,'REVIEW_OVERRIDE_DRIFT'):P.reviewed_donor_record(record,config)

if __name__=='__main__':unittest.main()
