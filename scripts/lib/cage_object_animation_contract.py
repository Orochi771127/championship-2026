"""Numeric OPM/NANR/NCER intake for offline art; never infer a playback clock."""
import hashlib
import json
from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8-sig')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def extract(root, field_id='field_cm32_01'):
    root = Path(root)
    work = root/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
    source = root/'docs/art/production/cage/faithful-hd40/fields'/field_id
    paths = [work/'fields'/field_id/'spec.json'] + [source/name for name in
             ('object-placement.json', 'object-animation-bank.json', 'object-cell-bank.json')]
    spec, placement, animation, cells = [json.loads(read(p)) for p in paths]
    sequences = {s['sequenceId']: s for s in animation['sequences']}
    cell_map = {c['cellIndex']: c for c in cells['cells']}
    if len(spec['objects']) != len(placement['placements']):
        raise ValueError('OBJECT_COUNT_DRIFT')
    objects = []
    for expected, actual in zip(spec['objects'], placement['placements']):
        locked = {'order': actual['ordinal'], 'sequenceId': actual['sequenceId'],
                  'placement': [actual['sourceX'], actual['sourceY']],
                  'horizontalFlip': actual['horizontalFlip'], 'verticalFlip': actual['verticalFlip']}
        if any(expected[k] != v for k, v in locked.items()):
            raise ValueError('PLACEMENT_OR_SEQUENCE_DRIFT')
        seq = sequences[actual['sequenceId']]
        if seq['frameCount'] != len(seq['frames']) or seq['frameCount'] != expected['sequenceFrameCount']:
            raise ValueError('SEQUENCE_FRAME_COUNT_DRIFT')
        frames = []
        for f in seq['frames']:
            b = cell_map[f['cellId']]['bounds']
            size = [b['maxXExclusive']-b['minX'], b['maxYExclusive']-b['minY']]
            pivot = [-b['minX'], -b['minY']]
            if size != expected['size'] or pivot != expected['pivot']:
                raise ValueError('PER_FRAME_CELL_GEOMETRY_REQUIRES_NEW_EXPORT')
            if type(f['rawDurationTicks']) is not int or f['rawDurationTicks'] <= 0:
                raise ValueError('INVALID_RAW_DURATION')
            frames.append({**f, 'size': size, 'pivot': pivot, 'durationMs': None})
        objects.append({**expected, 'frames': frames, 'loopStartFrame': seq['loopStartFrame'],
                        'rawWordA': seq['rawWordA'], 'rawWordB': seq['rawWordB']})
    return {'schemaVersion': 1, 'fieldId': field_id, 'objects': objects,
            'timingSemantics': animation['timingSemantics'], 'clockHz': None,
            'loopModeInterpreted': False, 'runtimeEligible': False,
            'reviewMode': 'MANUAL_FRAME_SELECTION_NOT_ORIGINAL_PLAYBACK',
            'sourceLocks': {p.relative_to(root).as_posix(): sha(p) for p in paths}}


def assert_unchanged(root, contract):
    if contract != extract(root, contract['fieldId']):
        raise ValueError('OBJECT_ANIMATION_CONTRACT_DRIFT')


def extract_variable(root, field_id):
    """Extract an offline-only contract that preserves per-frame size/pivot.

    This deliberately does not relax ``extract``. Fixed-window consumers keep
    failing closed when geometry changes; variable-window art exporters must
    opt into this schema and bind every output to its frame geometry.
    """
    root = Path(root)
    work = root/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
    source = root/'docs/art/production/cage/faithful-hd40/fields'/field_id
    paths = [work/'fields'/field_id/'spec.json'] + [source/name for name in
             ('object-placement.json', 'object-animation-bank.json', 'object-cell-bank.json')]
    spec, placement, animation, cells = [json.loads(read(p)) for p in paths]
    sequences = {s['sequenceId']: s for s in animation['sequences']}
    cell_map = {c['cellIndex']: c for c in cells['cells']}
    if len(spec['objects']) != len(placement['placements']):
        raise ValueError('OBJECT_COUNT_DRIFT')
    objects = []
    for expected, actual in zip(spec['objects'], placement['placements']):
        locked = {'order': actual['ordinal'], 'sequenceId': actual['sequenceId'],
                  'placement': [actual['sourceX'], actual['sourceY']],
                  'horizontalFlip': actual['horizontalFlip'], 'verticalFlip': actual['verticalFlip']}
        if any(expected[k] != value for k, value in locked.items()):
            raise ValueError('PLACEMENT_OR_SEQUENCE_DRIFT')
        sequence = sequences[actual['sequenceId']]
        if sequence['frameCount'] != len(sequence['frames']) or sequence['frameCount'] != expected['sequenceFrameCount']:
            raise ValueError('SEQUENCE_FRAME_COUNT_DRIFT')
        frames = []
        for frame in sequence['frames']:
            bounds = cell_map[frame['cellId']]['bounds']
            size = [bounds['maxXExclusive']-bounds['minX'], bounds['maxYExclusive']-bounds['minY']]
            pivot = [-bounds['minX'], -bounds['minY']]
            if type(frame['rawDurationTicks']) is not int or frame['rawDurationTicks'] <= 0:
                raise ValueError('INVALID_RAW_DURATION')
            frames.append({**frame, 'size': size, 'pivot': pivot, 'durationMs': None})
        objects.append({**expected, 'frames': frames, 'loopStartFrame': sequence['loopStartFrame'],
                        'rawWordA': sequence['rawWordA'], 'rawWordB': sequence['rawWordB'],
                        'variableFrameGeometry': len({(tuple(f['size']),tuple(f['pivot'])) for f in frames}) > 1})
    return {'schemaVersion': 2, 'fieldId': field_id, 'objects': objects,
            'perFrameGeometry': True, 'timingSemantics': animation['timingSemantics'], 'clockHz': None,
            'loopModeInterpreted': False, 'runtimeEligible': False,
            'reviewMode': 'MANUAL_FRAME_SELECTION_WITH_PER_FRAME_GEOMETRY_NOT_ORIGINAL_PLAYBACK',
            'sourceLocks': {p.relative_to(root).as_posix(): sha(p) for p in paths}}


def assert_variable_unchanged(root, contract):
    if contract != extract_variable(root, contract['fieldId']):
        raise ValueError('VARIABLE_OBJECT_ANIMATION_CONTRACT_DRIFT')
