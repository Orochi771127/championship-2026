"""Bounded ROM cell decoding for local reference builders.

Preserves per-cell VRAM transfers, 32-byte OBJ address units and tiled NCGR.
The decoding algorithm is shared with the existing appearance audit.
"""
import struct
from PIL import Image

def require(condition,message):
    if not condition: raise ValueError(message)

def native_bank(raw_folder, stem, cells):
    """Read NCER per-cell VRAM transfers, NCBR linear / NCGR tiled pixels.

    Used in memory for evidence equality and explicit external reference guides.
    Original source bank metadata must match the existing decoded cell bank.
    """
    ncer = (raw_folder / f'{stem}.ncer').read_bytes()
    require(ncer[:4] == b'RECN' and ncer[16:20] == b'KBEC', 'Unsupported NCER')
    count, bank_type = struct.unpack_from('<HH', ncer, 24)
    require(count == cells['cellCount'] and bank_type == cells['bankType'] == 1, 'NCER bank mismatch')
    require(struct.unpack_from('<I', ncer, 32)[0] == cells['mappingType'], 'NCER mapping drift')
    records = 24 + struct.unpack_from('<I', ncer, 28)[0]
    oam_base = records + count * 16
    for cell in cells['cells']:
        record = struct.unpack_from('<HHIhhhh', ncer, records + cell['cellIndex'] * 16)
        bounds = cell['bounds']
        require(record[:2] == (cell['oamCount'], cell['rawCellAttribute']), 'NCER record drift')
        require(record[3:] == (bounds['maxXExclusive'], bounds['maxYExclusive'], bounds['minX'], bounds['minY']), 'NCER bounds drift')
        for index, oam in enumerate(cell['oamEntries']):
            require(struct.unpack_from('<HHH', ncer, oam_base + record[2] + index*6)
                    == (oam['rawAttr0'], oam['rawAttr1'], oam['rawAttr2']), 'Raw OAM drift')
    transfer_offset = struct.unpack_from('<I', ncer, 36)[0]
    transfers = None
    if transfer_offset:
        block = 24 + transfer_offset
        maximum, relative = struct.unpack_from('<II', ncer, block)
        transfers = [struct.unpack_from('<II', ncer, block + relative + i*8) for i in range(count)]
        require(all(size <= maximum for _, size in transfers), 'VRAM transfer exceeds bank maximum')
    linear_path = raw_folder / f'{stem}.ncbr'
    linear = linear_path.exists()
    payload = (linear_path if linear else raw_folder / f'{stem}.ncgr').read_bytes()
    require(payload[:4] == b'RGCN' and payload[16:20] == b'RAHC', 'Unsupported graphics')
    pixel_format = struct.unpack_from('<I', payload, 28)[0]
    require(pixel_format in (3, 4), 'Unsupported pixel format')
    size, data_offset = struct.unpack_from('<II', payload, 40)
    start = 24 + data_offset
    graphics = payload[start:start+size]
    require(len(graphics) == size, 'Graphics payload truncated')
    colors = (raw_folder / f'{stem}.nclr').read_bytes()
    require(colors[:4] == b'RLCN' and colors[16:20] == b'TTLP', 'Unsupported palette')
    color_size, color_offset = struct.unpack_from('<II', colors, 32)
    raw_colors = colors[24+color_offset:24+color_offset+color_size]
    palette = [((c & 31)*255//31, ((c >> 5) & 31)*255//31, ((c >> 10) & 31)*255//31, 255)
               for c, in struct.iter_unpack('<H', raw_colors)]
    return {'graphics': graphics, 'palette': palette, 'transfers': transfers,
            'linear': linear, 'bpp': 4 if pixel_format == 3 else 8, 'mapping': cells['mappingType']}


def render_native(cell, bank):
    b = cell['bounds']
    image = Image.new('RGBA', (max(1, b['maxXExclusive']-b['minX']), max(1, b['maxYExclusive']-b['minY'])))
    source_offset, source_size = (bank['transfers'][cell['cellIndex']] if bank['transfers'] else (0, len(bank['graphics'])))
    graphics = bank['graphics'][source_offset:source_offset+source_size]
    require(len(graphics) == source_size, 'VRAM transfer outside graphics')
    for oam in cell['oamEntries']:
        require(not oam['affine'], 'Affine cell requires explicit original transform decoder')
        if oam['disabled']:
            continue
        width, height = oam['width'], oam['height']
        base = oam['tileIndex'] * (32 << bank['mapping'])
        for y in range(height):
            for x in range(width):
                sx = width-1-x if oam['horizontalFlip'] else x
                sy = height-1-y if oam['verticalFlip'] else y
                pixel = (sy*width+sx if bank['linear'] else
                         ((sy//8)*(width//8)+sx//8)*64 + (sy%8)*8 + sx%8)
                address = base + pixel*bank['bpp']//8
                require(address < len(graphics), 'OAM references outside VRAM transfer')
                index = graphics[address]
                if bank['bpp'] == 4:
                    index = (index >> (4*(pixel%2))) & 15
                if index:
                    palette_index = index + (oam['paletteBank']*16 if bank['bpp'] == 4 else 0)
                    dx, dy = oam['x']+x-b['minX'], oam['y']+y-b['minY']
                    require(0 <= dx < image.width and 0 <= dy < image.height, 'Visible OAM pixel outside signed bounds')
                    image.putpixel((dx,dy), bank['palette'][palette_index])
    return image, {'sourceOffsetBytes': source_offset, 'transferSizeBytes': source_size,
                   'layout': 'LINEAR_NCBR' if bank['linear'] else 'TILED_NCGR', 'bitsPerPixel': bank['bpp']}
