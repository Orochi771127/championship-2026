"""Transcribe functional Hunt columns. No strings, pointers, art or code shipped.

The source readers are in OVL0 0211585C, 021225BC, 02123B20,
0210EAD0, 021129C8, 02112A40 and 0210F0A4. See the source contract.
"""
import argparse
import json
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / 'research'))
from hunt_original_probe import load_rom, DEFAULT_ROM

ROOT = Path(__file__).resolve().parents[1]


def build(path):
    rom, arm, _ = load_rom(path)
    def byte(address): return arm[address - 0x02000000]
    def half(address): return struct.unpack_from('<H', arm, address - 0x02000000)[0]
    def word(address): return struct.unpack_from('<I', arm, address - 0x02000000)[0]
    def columns(address, count=3): return [byte(address + i) for i in range(count)]
    species = []
    for index in range(228):
        base = 0x020C1374 + index * 0x84
        species.append({'speciesIndex': index, 'generation': word(base + 12), 'alignment': word(base + 0x10), 'family': word(base + 0x18),
                        'displayCapacityG': byte(base + 0x1E),
                        'capacityG': byte(base + 0x1D),
                        'ropeTemperament': byte(base + 0x71),
                        'effectiveness': [byte(base + n) for n in [0x70, *range(0x72, 0x7E)]]})
    ropes = []
    for index in range(12):
        base = 0x020C98B0 + index * 40
        ropes.append({'itemIndex': index, 'durabilityByte': byte(base),
                      'coefficients': [[half(base + offset + column * 2) for column in range(3)]
                                       for offset in [12, 12, 18, 24, 30]]})
    shots = []
    for index in range(12):
        base = 0x020C9BAC + index * 16
        shots.append({'itemIndex': index, 'fireMode': byte(base + 4),
                      'impactStrength': byte(base + 5), 'statusSelector': byte(base + 6)})
    wires = []
    for index in range(6):
        base = 0x020C9F78 + index * 24
        wires.append({'itemIndex': index, 'maxLength': half(base + 4),
                      'bindingSeconds': columns(base + 7), 'damagePercent': columns(base + 10)})
    # Only timings and first-frame dimensions consumed by tool controllers.
    # No source pixels, source paths, frame cells or binary programs exported.
    animation_names = {'SHOT':['bullet_nomal','bullet_sleep','bullet_stun'],
                       'MEAT':['niku_nomal','niku_big','niku_poison','niku_stun'],
                       'DECOY':['decoy','decoy2'], 'LIGHT':['digilight','digilight2'],
                       'BOMB':['bom_nomal','bom_sleep','bom_stun','bom_flash'],
                       'MINE':['smallmine','hugemine'], 'CAPTURE_TRAP':['digicach','digiprison']}
    animations = {}
    for kind,names in animation_names.items():
        rows = []
        for name in names:
            stem = 'common/e002_hunt_'+name
            data = rom.files[rom.filenames.idOf(stem+'.nanr')]
            cells = rom.files[rom.filenames.idOf(stem+'.ncer')]
            count = struct.unpack_from('<H',data,24)[0]
            seq_base,frame_base,result_base=struct.unpack_from('<III',data,28)
            sequences=[]
            for sid in range(count):
                n,loop,_,mode,relative=struct.unpack_from('<HHIII',data,24+seq_base+sid*16)
                ticks=[struct.unpack_from('<H',data,24+frame_base+relative+j*8+4)[0] for j in range(n)]
                result=struct.unpack_from('<I',data,24+frame_base+relative)[0]
                cell=struct.unpack_from('<H',data,24+result_base+result)[0]
                cell_base=24+struct.unpack_from('<I',cells,28)[0]
                max_x,max_y,min_x,min_y=struct.unpack_from('<hhhh',cells,cell_base+cell*16+8)
                sequences.append({'ticks':ticks,'loop':loop,'mode':mode,'width':max_x-min_x,'height':max_y-min_y})
            rows.append(sequences)
        animations[kind]=rows
    return {'schemaVersion': 1, 'contract': 'HUNT_TOOL_FUNCTIONAL_SOURCES.v1',
            'controllerAnimations':animations,
            'pluginMasks': {'analyzer':[half(0x020CB950+i*16) for i in range(9)],
                            'checker':[half(0x020CB900+i*16) for i in range(5)],
                            'radar':[half(0x020CB9E0+i*16) for i in range(15)]},
            'species': species, 'ropes': ropes, 'shots': shots, 'wires': wires,
            'bombs': [{'itemIndex': i, 'damagePercent': columns(0x020C9D0C + i * 20),
                       'statusSelector': byte(0x020C9D0F + i * 20),
                       'blindPercent': columns(0x020C9D10 + i * 20)} for i in range(4)],
            'mines': [{'itemIndex': i, 'radius': byte(0x020C9ED6 + i * 20), 'damagePercent': columns(0x020C9ED7 + i * 20)} for i in range(2)],
            'meats': [{'itemIndex': i, 'radius': half(0x020C9E00 + i * 24),
                        'statusSelector': byte(0x020C9E02 + i * 24),
                        'poisonPercent': columns(0x020C9E03 + i * 24),
                        'attractionPercent': columns(0x020C9E06 + i * 24),
                        'nutrition': 32 if i == 1 else 16} for i in range(4)],
            'decoys': [{'itemIndex': i, 'attractionPercent': columns(0x020C9D80 + i * 20)} for i in range(2)],
            'lights': [{'itemIndex': i, 'attractionPercent': columns(0x020C9E8C + i * 16)} for i in range(2)]}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--rom', default=DEFAULT_ROM)
    args = parser.parse_args()
    output = ROOT / 'src/data/championship/catalogs/hunt-tools.r1.json'
    output.write_text(json.dumps(build(args.rom), indent=2) + '\n', encoding='utf-8', newline='\n')
    print(output)
