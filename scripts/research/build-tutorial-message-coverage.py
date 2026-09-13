"""Inventory tutorial evidence without treating bank order as control flow."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from ndspy.rom import NintendoDSRom

spec = importlib.util.spec_from_file_location('tutorial_bank', Path(__file__).parents[1] / 'build-tutorial-steps.py')
bank = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bank)
parser = argparse.ArgumentParser()
parser.add_argument('--rom', required=True)
parser.add_argument('--script', required=True)
parser.add_argument('--out', default='docs/research/TUTORIAL_MESSAGE_COVERAGE_2026-09-13.json')
args = parser.parse_args()
raw = Path(args.rom).read_bytes()
assert hashlib.sha256(raw).hexdigest() == bank.SHA
count, chunks = bank.read_bank(NintendoDSRom(raw))
observations = json.loads(Path('docs/research/TUTORIAL_CONTINUATION_OBSERVED_2026-09-09.json').read_text(encoding='utf-8'))
cpu = json.loads(Path('docs/research/TUTORIAL_MESSAGE_DISPATCH_CPU_2026-09-13.json').read_text(encoding='utf-8'))
assert cpu['romSha256'] == bank.SHA and all(c['passed'] for c in cpu['cases'])
selectors = {c['textId']: c['selector'] for c in cpu['cases']}
seen = {e['textId'] for t in observations['traces'] for e in t.get('observedTextEvents', [])}
seen.update(e['textId'] for e in observations['additionalVisualObservations'])
script = Path(args.script).read_bytes()
messages = []
for text_id in range(1495, 1567):
    assert text_id < count
    text = bank.decode(chunks[text_id])
    assert text.strip()
    evidence = ['TEXT_BANK_PRESENT']
    if text_id in selectors:
        evidence.append('BOUNDED_ORIGINAL_CPU_MESSAGE_DISPATCH')
    if text_id in seen:
        evidence.append('ORIGINAL_RUN_MESSAGE_OBSERVED')
    messages.append({
        'textId': text_id, 'lineCount': text.rstrip('\n').count('\n') + 1,
        'legacyCursor': text_id - 1515 if 1515 <= text_id <= 1549 else None,
        'raisingSelector': selectors.get(text_id), 'evidence': evidence,
        'advancePredicate': 'UNKNOWN_REQUIRES_TRACE',
    })
report = {
    'romSha256': bank.SHA, 'bank': bank.BANK, 'bankEntryCount': count,
    'inventoryCount': len(messages), 'legacySegmentCount': 35,
    'omittedFromLegacySegment': [m['textId'] for m in messages if m['legacyCursor'] is None],
    'cpuDispatchedCount': len(selectors), 'observedCount': len(seen),
    'bankOnlyCount': sum(len(m['evidence']) == 1 for m in messages),
    'normalOnboardingAccepted': False, 'fullOriginalProgressionVerified': False,
    'orderIsControlFlow': False,
    'scriptWitness': {'privatePath': str(Path(args.script).resolve()), 'sha256': hashlib.sha256(script).hexdigest(),
        'entry': '021265B8', 'initialRaising': '021267EF', 'returnFromHunt': '02127AB6', 'returnFromBattle': '02127BD1',
        'nativeCallCount': len({line.split()[2] for line in script.decode().splitlines()
                               if len(line.split()) == 3 and line.split()[1] == 'CALL_NATIVE'})},
    'evidenceSources': ['TUTORIAL_MESSAGE_DISPATCH_CPU_2026-09-13.json', 'TUTORIAL_CONTINUATION_OBSERVED_2026-09-09.json'],
    'messages': messages,
}
Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: report[k] for k in ['inventoryCount', 'legacySegmentCount', 'cpuDispatchedCount', 'observedCount', 'bankOnlyCount']}))
