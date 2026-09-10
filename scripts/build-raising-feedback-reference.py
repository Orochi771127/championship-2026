"""Verify the owner's common effect bank against ROM and package unchanged PNGs.

Numeric timelines are reproducible research data. Pixels stay in the ignored,
loopback-only reference bundle, under the existing production registry.
"""
import argparse, hashlib, json, io
from lib.native_object_reference import native_bank,render_native
from pathlib import Path
from ndspy.rom import NintendoDSRom

ROOT = Path(__file__).resolve().parents[1]
SHA = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
REL = 'assets/production/internal-faithful-baseline/raising-feedback-v1'
ASSET = 'art:vfx:raising-feedback:local-reference:v1'

def digest(b): return hashlib.sha256(b).hexdigest()
def emit(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((json.dumps(value, ensure_ascii=False, indent=2)+'\n').encode())

def build(archive, rom_path):
    raw = rom_path.read_bytes()
    assert digest(raw) == SHA
    rom = NintendoDSRom(raw)
    bank = 'e001_ikusei'
    folder = archive/'08_FULL_FAMILY_CONVERSION/common'/bank
    family = json.loads((folder/'family.json').read_text())
    cells_doc=json.loads((folder/'cells.json').read_text());cells=cells_doc['cells']
    animations = json.loads((folder/'animations.json').read_text())['sequences']
    assert not family['warnings']
    hashes = {}
    for source in family['sourceFiles']:
        name = source['name']
        source_bytes = (archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/common'/name).read_bytes()
        assert source_bytes == bytes(rom.files[rom.filenames.idOf('common/'+name)])
        hashes[name] = digest(source_bytes)
    numeric = dict(schemaVersion=1, romSha256=SHA, bank=bank, sourceHashes=hashes,
        evidence='STATIC_BINARY_READ', sequences=[dict(id=s['sequenceId'],
        playbackMode=s['rawWordB'], loopStartFrame=s['loopStartFrame'],
        frames=[dict(cell=f['cellId'], ticks=f['rawDurationTicks']) for f in s['frames']]) for s in animations])
    emit(ROOT/'src/data/championship/catalogs/raising-feedback.r1.json', numeric)
    packed = []
    native=native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/common',bank,cells_doc)
    for cell in cells:
        number = cell['cellIndex']; bounds = cell['bounds']; name = f'cell-{number:03}.png'
        pixels,_=render_native(cell,native);buffer=io.BytesIO();pixels.save(buffer,format='PNG');png=buffer.getvalue()
        dest = ROOT/REL/name; dest.parent.mkdir(parents=True, exist_ok=True); dest.write_bytes(png)
        packed.append(dict(cell=number, src=REL+'/'+name, sha256=digest(png),
            width=bounds['maxXExclusive']-bounds['minX'], height=bounds['maxYExclusive']-bounds['minY'],
            origin=[-bounds['minX'], -bounds['minY']]))
    entry = dict(assetId=ASSET, manifestPath=REL+'/manifest.json', runtimeEligible=True,
        localOnly=True, runtimeScope='LOOPBACK_RESEARCH_ONLY', rightsStatus='ROM_COPYRIGHTED_REFERENCE',
        publicReleasePermitted=False, shippingReady=False, humanApproved=False,
        productionStatus='OWNER_AUTHORIZED_LOCAL_REFERENCE', gameplayBinding='EXTERNAL_EXISTING_RUNTIME')
    emit(ROOT/REL/'manifest.json', dict(schemaVersion=1, **entry, cells=packed,
        provenance=dict(romSha256=SHA, sourceHashes=hashes, decodedCellCount=len(packed),decoder='NCER_VRAM_TRANSFER_LINEAR_OR_TILED')))
    index_path = ROOT/'assets/production/ART_PRODUCTION_INDEX.json'
    index = json.loads(index_path.read_text(encoding='utf-8'))
    index['entries'] = [e for e in index['entries'] if e['assetId'] != ASSET]+[entry]
    index['summary']['registeredRuntimeBundles'] = len(index['entries'])
    emit(index_path, index)
    print(json.dumps(dict(cells=len(packed), sequences=len(animations), rawFilesVerified=len(hashes))))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--rom', type=Path, required=True)
    args = parser.parse_args(); build(args.archive, args.rom)
