"""Publish metadata/behavior receipts, never ROM grids or emulator states."""
import argparse
import hashlib
import json
from pathlib import Path
from ndspy.rom import NintendoDSRom


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--rom', required=True)
    p.add_argument('--private-root', required=True)
    p.add_argument('--out', required=True)
    args = p.parse_args()
    root = Path(args.private_root)
    read = lambda path: json.loads(path.read_text(encoding='utf-8'))
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    original = read(root / 'entry3/entry-environment.json')
    observed = read(root / 'entry6/entry-environment.json')
    assert observed['romSha256'] == sha(Path(args.rom))
    assert not observed['hookErrors'] and not observed['gridWrites']
    assert original['ticks'] == observed['ticks'] == 876
    assert original['rngBefore'] == observed['rngBefore']
    assert original['rngAfter'] == observed['rngAfter']
    assert original['currentGrids'] == observed['currentGrids']
    assert original['rngCalls'] == [{k: v for k, v in x.items() if k != 'actualValue'} for x in observed['rngCalls']]
    assert all(x['value'] == x['actualValue'] for x in observed['rngCalls'])
    assert [{k: row[k] for k in original['wildRecords'][i]} for i, row in enumerate(observed['wildRecords'])] == original['wildRecords']
    chain = []
    for folder, checkpoint in [('entry', 'home-after-back.dst'), ('entry2', 'gate-before-confirm.dst')]:
        session = read(root / folder / 'entry-environment.json')
        chain.append({'sourceStateSha256': session['stateSha256'], 'actions': session['actions'],
                      'checkpointSha256': sha(root / folder / checkpoint)})
    assert chain[0]['checkpointSha256'] == chain[1]['sourceStateSha256']
    assert chain[1]['checkpointSha256'] == observed['stateSha256']
    rom = NintendoDSRom.fromFile(args.rom)
    loaders = []
    for index, event in enumerate(observed['events']):
        if event['kind'] != 'loader-entry': continue
        path = event['directory'] + '/' + event['filename']
        file_id = rom.filenames.idOf(path)
        raw = bytes(rom.files[file_id])
        if path.endswith('.atr'):
            import struct
            assert raw[:8] == b'DATR\x02\0\0\0'
            width, height = struct.unpack_from('<2I', raw, 8)
            offset = 16
        else:
            import struct
            assert raw[0] == 1 and path.endswith('.esc')
            width, height = struct.unpack_from('<2H', raw, 1)
            offset = 5
        result = next(e for e in observed['events'][index + 1:] if e['kind'] == 'loader-return' and e['loader'] == event['loader'])
        assert len(raw) == offset + width * height
        assert result['grid']['sha256'] == hashlib.sha256(raw[offset:]).hexdigest()
        assert observed['currentGrids'][event['loader']] == result['grid']
        loaders.append({'path': path, 'fileId': file_id, 'headerBytes': offset,
                        'loadTick': event['tick'], 'returnTick': result['tick'], **result['grid']})
    assert len(loaders) == 2
    initialization = [e for e in observed['events'] if e['kind'] in
                      ['gate-index-write', 'spawn-boundary', 'individual-constructor',
                       'actor-initialization', 'actors-registered', 'spawn-terrain-repair']
                      or (e['kind'] == 'range-rng' and e['caller'] in [0x0210B9DC, 0x0210BA5C, 0x0210BA74,
                                                                    0x0210BA9C, 0x0210BAC4, 0x0210BADC, 0x0210BB04])]
    receipt = {'status': 'ORIGINAL_NORMAL_ENTRY_OBSERVED_NOT_BROWSER_PARITY',
               'romSha256': observed['romSha256'], 'sourceChain': chain,
               'startStateSha256': observed['stateSha256'], 'actions': observed['actions'],
               'inputAuthority': observed['inputAuthority'], 'nativeHuntIndex': observed['nativeHuntIndex'],
               'environment': loaders, 'observationEndTick': observed['ticks'],
               'observedGridWrites': len(observed['gridWrites']), 'instrumentedReplayMatchesBaseline': True,
               'rngBefore': observed['rngBefore'], 'rngAfter': observed['rngAfter'],
               'rngCalls': observed['rngCalls'], 'initialization': initialization, 'wildRecords': observed['wildRecords'],
               'followWrites': observed['followWrites'],
               'limits': ['Private checkpoint resumes an actual Raising-to-Gate stylus sequence; this is not a fresh boot.',
                          'Observation covers native index1 (Grass variant02), not the old index0 successful capture.',
                          'No raw terrain/direction grid enters this receipt or runtime.',
                          'No original battery save, web normal spawn, capture or return-home acceptance claim.']}
    with Path(args.out).open('w', encoding='utf-8', newline='\n') as stream:
        stream.write(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'rngCalls': len(receipt['rngCalls']), 'wildCount': len(receipt['wildRecords']),
                      'environment': [e['path'] for e in loaders], 'normalWebCapture': False}))


if __name__ == '__main__':
    main()
