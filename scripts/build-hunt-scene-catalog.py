"""Build functional Gate, initial terrain/direction and scene inputs.

Original model/ATR/ESC bytes are read only by this offline builder. Product
output contains Gate vectors, terrain types and steering rules, never raw
files, pointers, rendered geometry, texture data or player checkpoints.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC

SHA = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
VECTORS = [(0,-4096),(2633,-3138),(3138,-2633),(4096,0),(3138,2633),(2633,3138),
           (0,4096),(-2633,3138),(-3138,2633),(-4096,0),(-3138,-2633),(-2633,-3138)]


def runs(values):
    out = []
    for v in values:
        if out and out[-1][1] == v: out[-1][0] += 1
        else: out.append([1,v])
    return out


def build(path):
    raw = Path(path).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SHA
    rom = NintendoDSRom(raw)
    arm = bytes(decompress(rom.arm9))
    word = lambda a: struct.unpack_from('<I',arm,a-0x02000000)[0]
    half = lambda a: struct.unpack_from('<H',arm,a-0x02000000)[0]
    def string(a):
        off = a-0x02000000
        assert 0 <= off < len(arm)
        return arm[off:arm.index(b'\0',off)].decode('ascii')
    def file(name):
        i = rom.filenames.idOf(name)
        assert i is not None, name
        return bytes(rom.files[i])

    cpu = Uc(UC_ARCH_ARM,UC_MODE_ARM)
    cpu.mem_map(0x02000000,0x800000)
    cpu.mem_write(0x02000000,arm)
    def put(a,v): cpu.mem_write(a,struct.pack('<I',v&0xffffffff))
    def execute(address,r0,r1,r2):
        for reg,value in [(UC_ARM_REG_R0,r0),(UC_ARM_REG_R1,r1),(UC_ARM_REG_R2,r2),
                          (UC_ARM_REG_SP,0x027D0000),(UC_ARM_REG_LR,0x027F0000)]:
            cpu.reg_write(reg,value&0xffffffff)
        cpu.emu_start(address,0x027F0000,count=200000)
        assert cpu.reg_read(UC_ARM_REG_PC) == 0x027F0000
        return cpu.reg_read(UC_ARM_REG_R0)

    # Original resolver only needs the loaded model pointer at object+0x58.
    # Parse the Nitro model dictionary offset, then let original ARM9/OVL12
    # resolve names, decode node transforms and multiply child by parent.
    model = file('gate_select/3D_worldMap_model.nsbmd')
    mdl0 = struct.unpack_from('<I',model,16)[0]
    assert model[mdl0:mdl0+4] == b'MDL0'
    dictionary = mdl0+8
    assert model[dictionary+1] == 1
    entries = dictionary+struct.unpack_from('<H',model,dictionary+6)[0]
    model_offset = mdl0+struct.unpack_from('<I',model,entries+4)[0]
    ovl = rom.loadArm9Overlays()[12]
    cpu.mem_write(ovl.ramAddress,bytes(ovl.data))
    cpu.mem_write(0x02500000,model)
    put(0x02600058,0x02500000+model_offset)
    gates = []
    for i in range(16):
        assert execute(0x0210C9D8,0x02600000,i,0x02601000) == 1
        row = 0x020C9558+i*36
        gates.append({'gateRecordIndex':i,'biomeId':string(word(row+8)),
            'dayIndex':word(row),'nightIndex':word(row+4),
            'positionQ12':list(struct.unpack('<3i',cpu.mem_read(0x02601000,12)))})

    # Initial reader cells: terrain is original 0207C9E8's result, not a byte
    # mask copied into a runtime art bundle. Steering retains only the fields
    # consumed by 0210D8B4; unknown low-nibble branches remain explicit.
    environments, fields = {}, []
    for i in range(32):
        descriptor = 0x020CAA9C+i*0x58
        field_id = string(word(descriptor+4))
        assert field_id.startswith('field_hm')
        effects = []
        for season in range(4):
            at = descriptor+0x14+season*0x10
            effects.append({'primaryPresent':word(at)!=0,'threshold':arm[at+4-0x02000000],
                'secondaryPresent':word(at+8)!=0,'parameter':half(at+12)})
        fields.append({'nativeHuntIndex':i,'fieldId':field_id,'sceneEffects':effects})
        if field_id in environments: continue
        terrain = file('field/'+field_id+'.atr')
        direction = file('field/'+field_id+'.esc')
        assert terrain[:8] == b'DATR\x02\0\0\0' and direction[0] == 1
        width,height = struct.unpack_from('<2I',terrain,8)
        assert (width,height) == struct.unpack_from('<2H',direction,1)
        assert len(terrain) == 16+width*height and len(direction) == 5+width*height
        for a,n in [(0x02602000,width),(0x02602004,height),(0x02602008,0x02603000),(0x02602010,0)]:put(a,n)
        terrain_types = {}
        for value in set(terrain[16:]):
            cpu.mem_write(0x02603000,bytes([value]))
            terrain_types[value] = execute(0x0207C9E8,0x02602000,0,0)
            assert terrain_types[value] in range(5)
        cells,palette = [],[]
        for value in direction[5:]:
            low = value&15
            cell = {'targetQ12':list(VECTORS[low])+[0],
                'blendQ12':4096 if value&0x20 else 0x59a if value&0x40 else 0xcd} if low<12 else {'unknownDirection':low}
            cell['escapeAnchor'] = bool(value & 0x80)
            cell['escapeBoundary'] = (value & ~0x20) in [0x0f, 0x8f]
            if cell not in palette: palette.append(cell)
            cells.append(palette.index(cell))
        environments[field_id] = {'width':width,'height':height,'wrap':False,
            'terrainRuns':runs([terrain_types[v] for v in terrain[16:]]),
            'directionPalette':palette,'directionRuns':runs(cells)}
    return {'schemaVersion':1,'contract':'HUNT_SCENE_SOURCES.v1','gates':gates,'fields':fields,'environments':environments}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--rom',required=True)
    p.add_argument('--out',default=str(Path(__file__).resolve().parents[1]/'src/data/championship/catalogs/hunt-scene.r1.json'))
    p.add_argument('--check',action='store_true')
    a = p.parse_args(); result = build(a.rom)
    text = json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n'
    out = Path(a.out)
    if a.check: assert out.read_bytes()==text.encode('utf-8')
    else: out.write_text(text,encoding='utf-8',newline='\n')
    print(json.dumps({'gates':len(result['gates']),'fields':len(result['fields']),
        'environments':len(result['environments']),'bytes':len(text),'sha256':hashlib.sha256(text.encode()).hexdigest()}))


if __name__=='__main__':main()
