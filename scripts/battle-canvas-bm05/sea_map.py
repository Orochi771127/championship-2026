"""Sea colour map for the BM05 canvas: deep blue offshore, lighter near the snow shelf.

    python -X utf8 scripts/battle-canvas-bm05/sea_map.py --out <work dir>

The play-area picture shades its sea by distance from the snow shore (deep
3,96,172 offshore to 16,155,213 in the shallows).  This writes sea-colour.png
(the whole canvas at half size) for the sea plane's texture in build_scene.py.
"""
import argparse
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import layout as L  # noqa: E402

DEEP = np.array([3, 96, 172], dtype=np.float32)
FAR = np.array([2, 82, 156], dtype=np.float32)
SHALLOW = np.array([16, 155, 213], dtype=np.float32)
REACH = 170.0          # base pixels over which the shallows fade out
PAD = 64               # the sea plane overhangs the canvas by this much


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    w, h = L.CANVAS_W + 2 * PAD, L.CANVAS_H + 2 * PAD
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    shift = lambda pts, dy=0.0: [(x - L.X0 + PAD, y - L.Y0 + PAD + dy) for x, y in pts]
    draw.polygon(shift(L.LAND), fill=255)
    draw.polygon(shift(L.LAND, L.LIFT * L.H_LAND), fill=255)      # the shelf's camera-facing lip
    land = np.array(mask)
    dist = cv2.distanceTransform((land == 0).astype(np.uint8), cv2.DIST_L2, 5)
    near = np.clip(1.0 - dist / REACH, 0.0, 1.0) ** 1.6
    yy = (np.arange(h, dtype=np.float32) - PAD + L.Y0)[:, None]
    north = np.clip((-yy - 260.0) / 320.0, 0.0, 1.0)            # the open sea darkens a little far north
    deep = DEEP[None, None, :] * (1 - north[..., None]) + FAR[None, None, :] * north[..., None]
    colour = deep * (1 - near[..., None]) + SHALLOW[None, None, :] * near[..., None]
    image = Image.fromarray(np.clip(colour + .5, 0, 255).astype(np.uint8), 'RGB')
    image = image.resize((w // 2, h // 2), Image.LANCZOS)
    image.save(out / 'sea-colour.png')
    print('SEA_MAP', image.size, out / 'sea-colour.png')


if __name__ == '__main__':
    main()
