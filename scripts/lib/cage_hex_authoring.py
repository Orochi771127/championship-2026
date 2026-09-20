"""Read-only bridge to native JS shape authority; no duplicate occupancy table."""
import json
import subprocess
from functools import lru_cache


@lru_cache(maxsize=1)
def footprints(root):
    return json.loads(subprocess.check_output(
        ['node','scripts/lib/cage-authoring-geometry.mjs','--hex-footprints'],cwd=root))


def field_footprint(root,field):
    record=next(f for f in footprints(root)['fields'] if f['fieldId']==field['id'])
    if record['definitionIndex']!=field['definitionIndex'] or record['nativeSize']!=field['nativeSize']:
        raise ValueError('HEX_AUTHORITY_DIMENSION_OR_BINDING_DRIFT: '+field['id'])
    return record
