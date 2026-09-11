"""Build the guided-tutorial step catalogue.

Order and identity come from the observed original run
(docs/research/TUTORIAL_CONTINUATION_OBSERVED_2026-09-09.json); the ROM is read
only to confirm every step's string exists in the general text bank and to
classify each one as an instruction or a remark. No original text, image or RAM
payload is written into the product — the catalogue carries indices and
structure, and the displayed wording is authored separately in
src/championship/text/.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path
from ndspy.rom import NintendoDSRom

SHA = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
BANK = 'ui/txt/txt_list_txt.dat'
TERMINATOR = b'\x3c\x3e\x0a'
FIRST, LAST = 1515, 1549
# The three stretches the observation report names, in the order it walks them.
PHASES = ((1515, 1526, 'RAISING'), (1527, 1527, 'GATE'), (1528, 1549, 'HUNT'))
# What the original's own line tells the player to do. A step with no instruction
# is a remark that only waits for acknowledgement. The predicate the cartridge
# uses internally to advance is not traced; this is read off the instruction.
ACTIONS = {
    1517: 'RELOCATE_TO_RECOVERY_CAGE',
    1522: 'SELECT_MEDICINE_TOOL',
    1523: 'APPLY_TOOL_TO_CREATURE',
    1526: 'OPEN_HUNT',
    1527: 'SELECT_GATE_TWICE',
    1529: 'SCROLL_HUNT_FIELD',
    1531: 'FIND_WILD',
    1539: 'ROPE_ENCLOSE',
    1540: 'ROPE_PULL',
    1541: 'HAND_CAPTURE',
    1543: 'FIND_WILD',
    1547: 'PLACE_FOOD',
    1548: 'USE_SHOT',
    1549: 'ROPE_ENCLOSE',
}


def read_bank(rom):
    """The bank is UTF-16LE entries separated by three raw bytes, so the file
    cannot be decoded in one pass: split on the terminator, decode each chunk."""
    def walk(folder, prefix=''):
        for index, name in enumerate(folder.files):
            yield prefix + name, folder.firstID + index
        for name, sub in folder.folders:
            yield from walk(sub, prefix + name + '/')
    files = dict(walk(rom.filenames))
    data = bytes(rom.files[files[BANK]])
    first = data.index(TERMINATOR)
    second = data.index(TERMINATOR, first + 3)
    count = int(data[first + 3:second])
    chunks = data[second + 3:].split(TERMINATOR)
    assert len(chunks) >= count, f'bank declares {count} entries, split gave {len(chunks)}'
    return count, chunks


def decode(chunk):
    """0x1B introduces one style code unit; a line break is a literal backslash
    and 'n'. Neither is part of the sentence."""
    text = chunk.decode('utf-16-le', errors='replace')
    out, index = [], 0
    while index < len(text):
        if text[index] == '\x1b':
            index += 2
            continue
        out.append(text[index])
        index += 1
    return ''.join(out).replace(chr(92) + 'n', '\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--rom', required=True)
    parser.add_argument('--observation',
                        default='docs/research/TUTORIAL_CONTINUATION_OBSERVED_2026-09-09.json')
    parser.add_argument('--out',
                        default='src/data/championship/catalogs/tutorial-steps.r1.json')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()

    raw = Path(args.rom).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SHA
    rom = NintendoDSRom(raw)
    count, chunks = read_bank(rom)

    observation = json.loads(Path(args.observation).read_text(encoding='utf-8'))
    observed = {event['textId']: trace['privateTrace']
                for trace in observation['traces']
                for event in trace.get('observedTextEvents', [])}
    for entry in observation.get('additionalVisualObservations', []):
        observed.setdefault(entry['textId'], entry['privateTrace'])
    # The observed ids must sit inside the range this catalogue claims, and must
    # already be in ascending order there — that is what makes the range the run.
    ordered = sorted(observed)
    assert ordered == sorted(i for i in ordered if FIRST <= i <= LAST), 'observed id outside the run'

    steps = []
    for step, text_id in enumerate(range(FIRST, LAST + 1)):
        assert text_id < count, f'text id {text_id} is outside the bank'
        body = decode(chunks[text_id])
        assert body.strip(), f'text id {text_id} is empty'
        phase = next(name for low, high, name in PHASES if low <= text_id <= high)
        steps.append({
            'step': step,
            'textId': text_id,
            'phase': phase,
            'advance': ACTIONS.get(text_id, 'ACKNOWLEDGE'),
            'lines': body.rstrip('\n').count('\n') + 1,
            'observedIn': observed.get(text_id),
        })

    assert len(steps) == LAST - FIRST + 1
    document = {
        'schemaVersion': 1,
        'contract': 'TUTORIAL_STEPS.v1',
        'evidence': 'OBSERVED_RUN_PLUS_BANK_INDEX',
        'romSha256': SHA,
        'bank': BANK,
        'bankEntryCount': count,
        'source': args.observation,
        'advanceProvenance': ('Each step\'s advance is read from the original line\'s own '
                              'instruction. The cartridge\'s internal advance predicate is not '
                              'traced, and no wording is copied into the product.'),
        'stepCount': len(steps),
        'observedStepCount': sum(1 for step in steps if step['observedIn']),
        'steps': steps,
    }
    text = json.dumps(document, ensure_ascii=False, separators=(',', ':')) + '\n'
    out = Path(args.out)
    if args.check:
        assert out.read_bytes() == text.encode('utf-8'), 'tutorial catalogue is stale'
    else:
        out.write_text(text, encoding='utf-8', newline='\n')
    print(json.dumps({'steps': len(steps), 'observed': document['observedStepCount'],
                      'phases': {name: sum(1 for s in steps if s['phase'] == name)
                                 for _, _, name in PHASES},
                      'actions': sum(1 for s in steps if s['advance'] != 'ACKNOWLEDGE')}))


if __name__ == '__main__':
    main()
