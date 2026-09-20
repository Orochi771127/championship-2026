"""Import an original generated sheet as review candidates, never as approved cells.

One common grid transform and palette for all panels. No per-frame fit, centering,
largest-component deletion, source-image copying, alias regeneration or promotion.
"""
from __future__ import annotations
import argparse
import importlib.util
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('m001_preflight', ROOT / 'scripts/prepare-character-production.py')
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)
KEYS = ('main/cell_000', 'main/cell_001', 'main/cell_002', 'main/cell_003',
        'main/cell_005', 'main/cell_008', 'main/cell_009', 'main/cell_010')


def normalize_sheet(image, palette, grid=(4, 2), sample_side=64, offset=(0, 0)):
    P.require(image.mode == 'RGBA', 'REAL_RGBA_REQUIRED')
    columns, rows = grid
    P.require(columns > 0 and rows > 0 and image.width * rows == image.height * columns, 'EXPECTED_SQUARE_PANEL_GRID')
    P.require(0 < sample_side <= 64 and all(0 <= v <= 64 - sample_side for v in offset), 'INVALID_SHARED_TRANSFORM')
    P.require(image.getchannel('A').getextrema() == (0, 255), 'TRANSPARENCY_REQUIRED')
    # Global sheet sampling, not independent bounding-box scaling of each sprite.
    sampled = image.resize((columns * sample_side, rows * sample_side), Image.Resampling.NEAREST)
    pixels = []
    for pixel in sampled.get_flattened_data():
        if pixel[3] < 128:
            pixels.append((0, 0, 0, 0))
        else:
            pixels.append(min(palette[1:], key=lambda color: sum((color[i] - pixel[i]) ** 2 for i in range(3))))
    sampled.putdata(pixels)
    result = Image.new('RGBA', (columns * 64, rows * 64))
    for index in range(columns * rows):
        x, y = index % columns * sample_side, index // columns * sample_side
        result.paste(sampled.crop((x, y, x + sample_side, y + sample_side)),
                     (index % columns * 64 + offset[0], index // columns * 64 + offset[1]))
    return result


def build(source, keys=KEYS, grid=(4, 2), sample_side=64, offset=(0, 0), prompt=None):
    preflight_files, plan = P.build(ROOT.parent / 'YDIJ_PRIVATE_ROM_ART_PACK')
    P.SOURCE.publish(preflight_files, P.WORK / 'generated', check=True)
    setting = P.read(P.PACK / 'pixel-v2/settings' / P.ENTITY / 'setting.json')
    palette = P.PIXEL.parse_palette(setting['palette'])
    P.require(len(keys) == grid[0] * grid[1] and len(set(keys)) == len(keys), 'INVALID_PANEL_KEYS')
    P.require(all(k in plan['slots'] and plan['slots'][k]['canonical'] == k for k in keys), 'CANONICAL_KEYS_REQUIRED')
    payload = source.read_bytes()
    with Image.open(source) as image:
        normalized = normalize_sheet(image, palette, grid, sample_side, offset)
        source_size = list(image.size)
    files = {'original-sheet.png': payload, 'normalized-sheet.png': P.PIXEL.png_bytes(normalized)}
    if prompt is not None:
        files['generation-prompt.txt'] = prompt.encode('utf-8')
    rows = []
    for i, key in enumerate(keys):
        x, y = i % grid[0] * 64, i // grid[0] * 64
        image = normalized.crop((x, y, x + 64, y + 64))
        bbox = image.getchannel('A').getbbox()
        P.require(bbox is not None, f'EMPTY_GENERATED_PANEL {key}')
        name = 'candidates/' + key.replace('/', '-') + '.png'
        files[name] = P.PIXEL.png_bytes(image)
        targets = [b + plan['geometry']['sourceOrigin'][i % 2]
                   for i, b in enumerate(plan['slots'][key]['visibleBounds'])]
        rows.append({'intendedCanonical': key, 'image': name, 'alphaBounds': list(bbox),
                     'sourceVisibleBoundsOn64': targets,
                     'geometryStatus': 'NEEDS_MANUAL_LANDMARK_REVIEW',
                     'artStatus': 'CANDIDATE_NOT_APPROVED',
                     'mouthEyesOcclusionStatus': 'PENDING',
                     'eligibleToFillSlots': False,
                     'dependentSlots': [k for k, v in plan['slots'].items() if v['canonical'] == key]})
    aliases = {key: {'canonical': value['canonical'],
                     'translation': value['sourceTranslationFromCanonical']}
               for key, value in plan['slots'].items() if value['sameAsCell']}
    files['candidate-bank.json'] = P.encoded({'entityId': P.ENTITY, 'designVersion': setting['designVersion'],
        'sourceSize': source_size, 'grid': list(grid), 'outputCellSize': [64, 64],
        'normalization': {'sampling': 'WHOLE_SHEET_NEAREST', 'panelSampleSize': sample_side,
                          'sharedOffset': list(offset), 'alphaThreshold': 128, 'palette': 'SHARED_SETTING_PALETTE'},
        'originalSourceSha256': P.sha(payload), 'palette': setting['palette'], 'candidates': rows,
        'sourceReuse': aliases, 'runtimeEligible': False, 'acceptedMasters': 0,
        'requiresAllMasters': 53, 'requiresAllSlots': 83, 'requiresAllSequences': 53,
        'model': 'BUILTIN_IMAGEGEN_BACKEND_VERSION_NOT_EXPOSED',
        'higgsfieldCalls': 0, 'nextEntityAllowed': False})
    lines = ['# m001 Main / Sub 重用核對', '',
        '來源：既有 source-reuse.json，加上 transfer-aware native 解碼與 preflight 雜湊驗證。',
        '83 槽位 = 53 獨立原生畫格 + 12 個 Main 重用槽 + 18 個 Sub 重用槽。',
        'Sub 全部可重用 Main；保留各自 sequence / ticks，不另生圖。', '',
        '| 重用槽位 | 母格 | 原生位移 |', '|---|---|---|']
    for key, value in aliases.items():
        lines.append(f"| {key} | {value['canonical']} | {value['translation']} |")
    files['REUSE_VERIFIED.md'] = ('\n'.join(lines) + '\n').encode('utf-8')
    files['receipt.json'] = P.encoded({'files': {k: P.sha(v) for k, v in sorted(files.items())},
                                      'importerSha256': P.sha(Path(__file__).read_bytes()),
                                      'preflightSha256': P.sha(P.encoded(plan))})
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=P.WORK / 'original-art-r01')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--pair-011-012', action='store_true')
    parser.add_argument('--prompt', type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    P.require(output.is_relative_to(P.WORK.resolve()) and output != P.WORK.resolve(), 'OUTPUT_OUTSIDE_WORK_AREA')
    options = {'keys': ('main/cell_011', 'main/cell_012'), 'grid': (2, 1),
               'sample_side': 32, 'offset': (18, 15)} if args.pair_011_012 else {}
    if args.prompt:
        options['prompt'] = args.prompt.read_text(encoding='utf-8')
    P.SOURCE.publish(build(args.source.resolve(), **options), output, args.check)
    print(f'CANDIDATES={len(options.get("keys", KEYS))} ACCEPTED=0 SUB_REGENERATIONS=0 RUNTIME_ELIGIBLE=false')


if __name__ == '__main__':
    main()
