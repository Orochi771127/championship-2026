"""Validate Batch C meadow by reusing the dedicated two-cell verifier."""
import importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
loader=importlib.util.spec_from_file_location('meadow_refinement_review',ROOT/'scripts/check-cage-meadow.py')
review=importlib.util.module_from_spec(loader);loader.loader.exec_module(review)
review.OUT=review.WORK/'opm-meadow-refinement-v2'

_original_read=review.read
def build():
    # The base verifier's structural logic remains authoritative; only its
    # producer key points at this isolated refinement builder.
    original_sha=review.sha
    def mapped_sha(path):
        if Path(path)==ROOT/'scripts/build-cage-meadow.py':return original_sha(ROOT/'scripts/build-cage-meadow-refinement.py')
        return original_sha(path)
    review.sha=mapped_sha
    return review.build()

if __name__=='__main__':build()
