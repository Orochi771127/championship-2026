"""Draft a donor review from measurements, then let a reviewer confirm it after actually looking.

`character-donor-review.py <entity>` writes a template whose 47-odd cell observations are all null, and
filling them by hand is what limits the roster to about one character a day. Everything that can be read
off the inventory, the motion contract and the donor pixels is drafted here instead; the four character
fields that need eyes are marked, and `--confirm` refuses while a marker is still there.

    python scripts/draft-character-donor-review.py m201_agumon            # draft + build the sheets
    python scripts/draft-character-donor-review.py m201_agumon --confirm "what the reviewer saw"

Research sheets are written next to the pose guides outside the product repository. No donor pixels enter
the repo: the review stores words and hashes only.
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('donor_preflight', ROOT / 'scripts/prepare-character-production.py')
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)
BASE = P.PACK / 'donor-review-v1'
GUIDES = ROOT.parent / '_archive/character-appearance-refresh-v1/pose-guides'
MARKER = 'DRAFT_FROM_MEASUREMENT'
NEEDS_EYES = ('morphology', 'locomotion', 'faceAndExpression', 'appendages')

# What the game asks each main-screen sequence for. Traced in docs/research and reused by the motion tables.
PURPOSE = {
    0: 'neutral idle', 1: 'tired or slow idle', 2: 'walk', 3: 'run', 4: 'jump or bounce',
    5: 'land or light hit', 6: 'hit', 7: 'attack (move class 0)', 8: 'attack (move class 1)',
    9: 'attack (move class 2)', 10: 'attack (move class 3)', 11: 'lifted or pulled', 12: 'slow walk',
    13: 'sleep', 14: 'eat', 15: 'down or sick', 26: 'special hit flash', 27: 'black silhouette',
    28: 'full or satisfied', 29: 'raising reaction 4', 30: 'food or training', 31: 'raising reaction 8/22/29',
    32: 'raising reaction 25', 33: 'raising reaction 2 or move prelude', 34: 'raising reaction 30',
    35: 'raising reaction 7', 36: 'stone-gray state', 37: 'heavy hit', 38: 'hit reaction 6',
    39: 'evolution white silhouette',
}
PURPOSE.update({slot: f'restrained version of sequence {slot - 16}' for slot in range(16, 26)})
SUB_PURPOSE = {0: 'lower-screen default', 5: 'lower-screen defeat', 9: 'lower-screen victory'}


# Which recolour a cell carries follows from the sequence that plays it, not from its colours: a naturally
# black, grey or pale creature defeats every colour threshold, and a donor's flash frame keeps its eye marks.
# Sequence 26 plays flash, normal, flash, black; 27 is black, 36 stone-gray and 39 the evolution white.
def special_kinds(contract):
    kinds = {}
    for sequence in contract['sides']['main']['sequences']:
        cells = [frame['cell'] for frame in sequence['frames']]
        if sequence['id'] == 26 and len(cells) >= 4:
            for index, cell in enumerate(cells):
                if index != 1:
                    kinds[f'main/cell_{cell:03d}'] = 'black silhouette' if index == 3 else 'warm flash'
        elif sequence['id'] in (27, 36, 39):
            label = {27: 'black silhouette', 36: 'stone-gray', 39: 'evolution white'}[sequence['id']]
            for cell in cells:
                kinds[f'main/cell_{cell:03d}'] = label
    return kinds


def colour_count(image):
    return len({pixel[:3] for pixel in image.get_flattened_data() if pixel[3]})


def load(entity):
    inventory = P.read(BASE / entity / 'inventory.json')
    review = P.read(BASE / entity / 'review.json')
    contract = P.read(P.PACK / 'generated/entities' / entity / 'motion-contract.json')
    images = {}
    for side in ('main', 'sub'):
        for path in sorted((GUIDES / entity / side).glob('cell-*.png')):
            images[f'{side}/cell_{int(path.stem.split("-")[1]):03d}'] = Image.open(path).convert('RGBA')
    P.require(images, 'NO_POSE_GUIDES ' + entity)
    return inventory, review, contract, images


def usage(contract):
    """cell key -> [(side, sequence id, frame index, ticks, playback)]"""
    out = {}
    for side in ('main', 'sub'):
        for sequence in contract['sides'][side]['sequences']:
            for index, frame in enumerate(sequence['frames']):
                out.setdefault(f"{side}/cell_{frame['cell']:03d}", []).append(
                    (side, sequence['id'], index, frame['ticks'], sequence['playbackMode']))
    return out


def describe(key, inventory, uses, images, idle_bounds, kinds):
    slot = inventory['slots'][key]
    side = key.split('/')[0]
    bounds = slot['nativeBounds']
    width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
    rows = uses.get(key, [])
    table = PURPOSE if side == 'main' else SUB_PURPOSE
    where = '; '.join(f"sequence {sid} frame {index} ({table.get(sid, 'purpose not traced')}), {ticks} ticks"
                      for _, sid, index, ticks, _ in rows[:4]) or 'no sequence uses this cell'
    parts = [f'Measured from the donor inventory, motion contract and pose guides: used at {where}.']
    parts.append(f'Native bounds {bounds}, {width} by {height} pixels.')
    if idle_bounds and key != f'{side}/cell_000':
        taller = (idle_bounds[3] - idle_bounds[1]) - height
        wider = width - (idle_bounds[2] - idle_bounds[0])
        shape = []
        if abs(taller) > 2:
            shape.append('lower' if taller > 0 else 'taller')
        if abs(wider) > 2:
            shape.append('wider' if wider > 0 else 'narrower')
        if bounds[3] < idle_bounds[3] - 2:
            shape.append('clear of the ground contact')
        if shape:
            parts.append('Against the idle cell it reads ' + ' and '.join(shape) + '.')
    if slot['canonical'] != key:
        parts.append(f"Alias of {slot['canonical']} translated by {slot['translation']}.")
    if key in kinds:
        colours = colour_count(images[key]) if key in images else 0
        parts.append(f'The donor plays this cell as the {kinds[key]} state ({colours} visible colours), '
                     'so the original character derives it by recolour rather than drawing it.')
    if side == 'main' and any(16 <= sid <= 25 for _, sid, _, _, _ in rows):
        parts.append('Restrained block: the original needs the external wrap crossing this pose.')
    return ' '.join(parts)


def research_sheets(entity):
    """The all-cell and per-sequence sheets character-donor-review.py already publishes for a reviewer."""
    folder = ROOT.parent / '_archive/character-donor-review-v1' / entity
    names = sorted(path.name for path in folder.glob('*.png'))
    P.require(names, 'NO_RESEARCH_SHEETS ' + str(folder))
    return names


def checkerboard_sheets(entity, inventory, images):
    written = []
    for side in ('main', 'sub'):
        keys = sorted(key for key in images if key.startswith(side + '/'))
        if not keys:
            continue
        scale, columns, pad, label = 6, 8, 10, 16
        tile = 64 * scale // 2
        rows = (len(keys) + columns - 1) // columns
        # A flat dark ground hides the black silhouette states and a flat light one hides the white
        # evolution state, so the sheet a reviewer looks at is a checkerboard: both read against it.
        sheet = Image.new('RGBA', (columns * (tile + pad), rows * (tile + pad + label)), (120, 126, 138, 255))
        draw = ImageDraw.Draw(sheet)
        for y in range(0, sheet.height, 16):
            for x in range(0, sheet.width, 16):
                if (x // 16 + y // 16) % 2:
                    draw.rectangle([x, y, x + 15, y + 15], fill=(150, 156, 168, 255))
        for index, key in enumerate(keys):
            x, y = index % columns * (tile + pad), index // columns * (tile + pad + label)
            image = images[key]
            box = image.getchannel('A').getbbox()
            if box:
                crop = image.crop(box)
                factor = max(1, min(tile // max(crop.width, 1), tile // max(crop.height, 1)))
                big = crop.resize((crop.width * factor, crop.height * factor), Image.NEAREST)
                sheet.alpha_composite(big, (x + (tile - big.width) // 2, y + tile - big.height))
            draw.text((x + 4, y + tile + 2), key.split('/')[1], fill=(18, 20, 26))
        path = GUIDES / entity / f'{side}-all-cells.png'
        sheet.save(path)
        written.append(path.name)
    return written


def draft(entity):
    inventory, review, contract, images = load(entity)
    uses = usage(contract)
    idle = inventory['slots'].get('main/cell_000', {}).get('nativeBounds')
    kinds = special_kinds(contract)
    observations = {key: describe(key, inventory, uses, images, idle, kinds)
                    for key in sorted(review['cellObservations'])}
    main_sequences = {s['id'] for s in contract['sides']['main']['sequences']}
    restrained = sorted({key for key in observations if key.startswith('main/')
                         and any(16 <= sid <= 25 for _, sid, _, _, _ in uses.get(key, []))})
    specials = {key: kind for key, kind in kinds.items() if key in observations}
    union = inventory['nativeBoundsUnion']
    origin = inventory['sourceOrigin']
    character = {
        'contactAndOrigin': (f"Shared source origin is {origin} on a {inventory['canvas']} canvas, from a native bounds "
                             f"union of {union}. Every cell is placed against that origin; no cell is recentred or resized."),
        'restraint': ('Restrained cells are ' + ', '.join(key.split('/')[1] for key in restrained) +
                      '. Each mirrors its unrestrained sequence tick for tick and needs an external wrap that crosses the '
                      'body and is never read as anatomy.') if restrained else 'No restrained sequences in this contract.',
        'specialStates': ('; '.join(f"{key.split('/')[1]} is a {value} state" for key, value in sorted(specials.items()))
                          + '. Each is derived by recolour from an authored pose, never redrawn.') if specials
                         else 'No recoloured special states in this contract.',
    }
    for field in NEEDS_EYES:
        # A field a reviewer has already rewritten is kept; only blanks and drafts are replaced.
        existing = (review.get('character') or {}).get(field)
        character[field] = existing if existing and MARKER not in str(existing) else (
            f'{MARKER}: {inventory["counts"]["masters"]} masters over {inventory["counts"]["slots"]} slots, '
            f'sequences {min(main_sequences)}-{max(main_sequences)}. Replace this line after looking at the '
            f'all-cell and per-sequence sheets.')
    review['cellObservations'] = observations
    review['character'] = character
    review['researchImagesReviewed'] = research_sheets(entity)
    checkerboard_sheets(entity, inventory, images)
    review['draftedBy'] = 'scripts/draft-character-donor-review.py from inventory, motion contract and pose guides'
    review['status'] = 'PENDING_VISUAL_REVIEW'
    review['unresolvedBlockingIssues'] = [f'{field} still needs a visual pass' for field in NEEDS_EYES]
    write(entity, review)
    print(json.dumps({'entity': entity, 'observations': len(observations), 'restrainedCells': len(restrained),
                      'specialCells': len(specials), 'sheets': review['researchImagesReviewed'],
                      'needsEyes': list(NEEDS_EYES), 'sheetFolder': str(GUIDES / entity)}, ensure_ascii=False, indent=2))


def confirm(entity, note):
    inventory, review, _, _ = load(entity)
    blank = [key for key, value in review['cellObservations'].items() if not value]
    P.require(not blank, 'OBSERVATIONS_STILL_BLANK ' + str(blank[:5]))
    pending = [field for field, value in review['character'].items() if not value or MARKER in str(value)]
    P.require(not pending, 'STILL_DRAFTED_WITHOUT_A_VISUAL_PASS ' + str(pending))
    P.require(len(note) > 40, 'REVIEW_NOTE_TOO_SHORT')
    review['reviewer'] = note
    review['status'] = 'PASS_DONOR_REVIEW'
    review['unresolvedBlockingIssues'] = []
    write(entity, review)
    print('PASS_DONOR_REVIEW', entity)


def write(entity, review):
    review['inventorySha256'] = P.sha((BASE / entity / 'inventory.json').read_bytes())
    path = BASE / entity / 'review.json'
    temporary = path.with_suffix('.json.tmp')
    temporary.write_bytes(P.encoded(review))
    temporary.replace(path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('entity')
    parser.add_argument('--confirm', help='reviewer note describing what was actually seen in the sheets')
    arguments = parser.parse_args()
    if arguments.confirm:
        confirm(arguments.entity, arguments.confirm)
    else:
        draft(arguments.entity)
