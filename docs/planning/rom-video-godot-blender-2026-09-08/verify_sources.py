"""Read-only ROM/video source checks for the 2026-09-08 design handoff.

Writes bounded metadata only to this new handoff directory. No ROM or images
are copied, and no gameplay or existing research files are changed.
"""
from pathlib import Path
import csv
import hashlib
import importlib.util
import json
import re
import subprocess
import sys

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SHA = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
ROM = Path('R:/') / (SHA + '.nds')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    import ndspy.rom
    raw = ROM.read_bytes()
    assert sha(raw) == SHA, 'ROM SHA mismatch'
    rom = ndspy.rom.NintendoDSRom(raw)
    spec = importlib.util.spec_from_file_location('handoff_text_bank', REPO / 'scripts/lib/ydij_text_bank.py')
    parser = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(parser)
    help_raw = rom.getFileByName('ui/txt/help_text_txt.dat')
    tutorial_raw = rom.getFileByName('ui/txt/txt_list_txt.dat')
    help_entries = parser.parse_bank(help_raw)
    tutorial_entries = parser.parse_bank(tutorial_raw)
    csv_path = Path('R:/NEXUS LINK/原作/research-only/YDIJ_FULL_ROM_DECONSTRUCTION_2026-08-29/analysis/text/help_text_txt.csv')
    with csv_path.open(encoding='utf-8-sig', newline='') as stream:
        rows = list(csv.reader(stream))
    indexed = {int(row[1]): row[2] for row in rows if len(row) >= 3 and row[1].isdigit()}
    selected = list(range(89, 106)) + list(range(113, 149)) + list(range(153, 168))
    text_matches = [{'id': i, 'matchesArchive': help_entries[i] == indexed[i]} for i in selected]
    assert all(x['matchesArchive'] for x in text_matches), 'Help transcription mismatch'
    old_tutorial = json.loads((REPO / 'docs/reports/parity-audit/2026-09-05/original-feeding-tutorial.json').read_text(encoding='utf-8'))
    tutorial_matches = [{'id': x['index'], 'matchesArchive': parser.plain(tutorial_entries[x['index']]) == x['text']} for x in old_tutorial['entries']]
    assert all(x['matchesArchive'] for x in tutorial_matches), 'Tutorial transcription mismatch'
    index_path = REPO / 'docs/research/video-BV13u411B7BK/VIDEO_OBSERVATIONS.json'
    index = json.loads(index_path.read_text(encoding='utf-8'))
    frames = []
    reviewed = {'V02', 'V05', 'V10', 'V12', 'V16', 'V20', 'V39'}
    for row in index['observations']:
        p = Path(row['framePath'])
        actual = sha(p.read_bytes())
        assert actual == row['sha256'], row['id']
        frames.append({'id': row['id'], 'path': str(p), 'mediaSeconds': row['recordedMediaSeconds'], 'sha256': actual, 'hashMatches': True, 'visuallyReviewedThisTurn': row['id'] in reviewed})
    extra = Path('R:/Projects/Championship2026/_archive/video-research/BV13u411B7BK/battle-recheck-2026-09-07/verified-202.png')
    battle_receipt = json.loads((REPO / 'docs/research/video-BV13u411B7BK/BATTLE_VIDEO_CAPTURE_RECEIPT_2026-09-07.json').read_text(encoding='utf-8'))
    extra_record = next(x for x in battle_receipt['captures'] if x['file'] == extra.name)
    assert extra_record['observationStatus'] == 'VIDEO_OBSERVED'
    assert sha(extra.read_bytes()) == extra_record['sha256']
    source_docs = [
        'AGENTS.md', 'README.md', 'docs/coordination/OWNER_DIRECTION.md',
        'docs/CURRENT_PRODUCT_STATUS.md', 'docs/architecture/CHAMPIONSHIP_2026_ARCHITECTURE.md',
        'docs/research/video-BV13u411B7BK/ANALYSIS_ZH_TW.md',
        'docs/research/HUNT_CAPTURE_CONFIRMATION_2026-09-08.md',
        'docs/research/HUNT_CORE_TWO_STAGE_IMPLEMENTATION_2026-09-08.md',
        'docs/research/CAGE_IDENTITY_BINDING_ROM_TRACE_2026-09-05.md',
        'docs/contracts/championship/CHAMPIONSHIP_RANCH_NATIVE_GEOMETRY.v1.json',
        'docs/contracts/championship/CHAMPIONSHIP_RANCH_TILE_COMPOSITION.v1.json',
        'docs/research/round2-clock-2026-09-05/CLOCK_ROM_TRACE.md',
        'docs/research/video-BV13u411B7BK/BATTLE_PRESENTATION_ROM_COMPARISON_2026-09-07.md',
        'docs/art/production/battle-presentation-r13/IMPLEMENTATION_2026-09-08.md',
    ]
    link_count = 0
    for doc in HERE.glob('*.md'):
        content = doc.read_text(encoding='utf-8')
        assert content.count('```') % 2 == 0, f'Unclosed code fence: {doc.name}'
        assert '\ufffd' not in content, f'Encoding replacement: {doc.name}'
        assert all(line == line.rstrip() for line in content.splitlines()), f'Trailing whitespace: {doc.name}'
        for match in re.finditer(r'\[[^\]]*\]\(([^)]+)\)', content):
            target = match.group(1).split('#')[0]
            if target and not target.startswith(('https://', 'http://')):
                assert (doc.parent / target).resolve().exists(), f'Broken link: {doc.name}: {target}'
                link_count += 1
    for receipt in HERE.glob('*.json'):
        json.loads(receipt.read_text(encoding='utf-8'))
    result = {
        'date': '2026-09-08', 'scope': 'DOCUMENTATION_HANDOFF_SOURCE_VERIFICATION',
        'repoRoot': str(REPO),
        'branch': subprocess.check_output(['git', 'branch', '--show-current'], cwd=REPO, text=True).strip(),
        'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip(),
        'sharedWorktreeWasDirty': True,
        'rom': {'path': str(ROM), 'sha256': SHA, 'bytes': len(raw), 'title': raw[:12].rstrip(b'\0').decode('ascii'), 'gameCode': raw[12:16].decode('ascii')},
        'helpBank': {'sha256': sha(help_raw), 'entryCount': len(help_entries), 'checkedEntries': text_matches},
        'tutorialBank': {'sha256': sha(tutorial_raw), 'entryCount': len(tutorial_entries), 'checkedEntries': tutorial_matches},
        'video': {'sourceId': index['sourceId'], 'durationSeconds': index['durationSeconds'], 'archiveFrames': frames,
                  'additionalReviewedFrame': {'path': str(extra), 'sha256': sha(extra.read_bytes()), 'mediaSecondsFromExistingReceipt': extra_record['time'], 'hashMatchesExistingReceipt': True},
                  'liveCheck': 'Opened the current page and visually confirmed title frame; player advertised a 30-second trial/login notice. No full fresh playback claimed.',
                  'visualReviewCountThisTurn': 8, 'archiveHashCount': len(frames)},
        'documents': [{'path': p, 'sha256': sha((REPO / p).read_bytes())} for p in source_docs],
        'documentValidation': {'markdownFiles': len(list(HERE.glob('*.md'))), 'localLinksChecked': link_count, 'codeFencesBalanced': True, 'noTrailingWhitespace': True, 'jsonFilesParse': True},
        'limits': ['No fresh emulator capture or complete game playthrough.', 'Help text confirms described rules, not arithmetic/control flow.', 'Older reports retain their own bounded proof status.', 'English video and Japanese YDIJ are not asserted byte-equivalent.', 'No Godot project or Blender asset is built by this documentation task.'],
    }
    (HERE / 'source-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'rom': result['rom'], 'helpMatches': len(text_matches), 'tutorialMatches': len(tutorial_matches), 'frameHashMatches': len(frames), 'visuallyReviewedFrames': 8, 'documents': result['documentValidation']}, ensure_ascii=False))

if __name__ == '__main__':
    main()
