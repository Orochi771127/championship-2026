"""Ground painting for a wide battle canvas (plain Python: numpy, PIL, OpenCV).

The ring's ground is painted as one flat picture in canvas pixels.  Its textures are taken
from the arena's own live picture (project original): clean patches of its grass, sand,
stone ... are flattened and quilted into as much ground as the canvas needs, so the ring has
the play area's own brushwork and colour.  Regular floors (flagstones, panels) are continued
on their own grid instead, so the joints line up across the seam.
"""
import cv2
import numpy as np
from PIL import Image, ImageDraw

import canvaslib as C


class Ground:
    def __init__(self, field_id):
        self.field_id = field_id
        self.record = C.field_record(field_id)
        self.base = np.array(Image.open(C.ROOT / self.record['frames'][0]['src']).convert('RGB')).astype(np.float32)
        if self.base.shape[:2] != (C.BASE_H, C.BASE_W):
            raise ValueError('BASE_SIZE')
        self.reference = self._runtime_look()
        self.h, self.w = C.CANVAS_H, C.CANVAS_W
        self.notes = {}        # facts for the props step (make.py writes them to notes.json)

    # ------------------------------------------------------------------ sources

    def _runtime_look(self):
        """The play area as the game shows it at rest: the picture plus its still foliage layers."""
        ambient = self.record.get('ambient', {})
        rows = ([ambient['foliageStatic']] if ambient.get('foliageStatic') else []) + list(ambient.get('canopies', []))
        if not rows:
            return self.base.copy()
        image = Image.fromarray(self.base.astype(np.uint8)).convert('RGBA')
        for row in rows:
            sprite = Image.open(C.ROOT / row['src']).convert('RGBA')
            scale = row.get('scale', 1)
            if scale != 1:
                sprite = sprite.resize((round(sprite.width * scale), round(sprite.height * scale)), Image.LANCZOS)
            image.alpha_composite(sprite, (int(row.get('x', 0)), int(row.get('y', 0))))
        return np.array(image.convert('RGB')).astype(np.float32)

    def patch(self, x0, y0, x1, y1, source='base'):
        """A rectangle of the play-area picture (base pixels)."""
        return getattr(self, source)[y0:y1, x0:x1].copy()

    def sprite_patch(self, src, x0, y0, x1, y1):
        """A rectangle of one of the arena's own layer pictures, with its alpha (RGB, alpha)."""
        sprite = np.array(Image.open(C.ROOT / src).convert('RGBA')).astype(np.float32)[y0:y1, x0:x1]
        return sprite[..., :3], sprite[..., 3] / 255.0

    def foliage_alpha(self):
        """Where the still foliage layers cover the play area (0..1)."""
        ambient = self.record.get('ambient', {})
        rows = ([ambient['foliageStatic']] if ambient.get('foliageStatic') else []) + list(ambient.get('canopies', []))
        cover = np.zeros((C.BASE_H, C.BASE_W), dtype=np.float32)
        for row in rows:
            alpha = np.array(Image.open(C.ROOT / row['src']).convert('RGBA'))[..., 3].astype(np.float32) / 255.0
            x, y = int(row.get('x', 0)), int(row.get('y', 0))
            h, w = min(alpha.shape[0], C.BASE_H - y), min(alpha.shape[1], C.BASE_W - x)
            cover[y:y + h, x:x + w] = np.maximum(cover[y:y + h, x:x + w], alpha[:h, :w])
        return cover

    @staticmethod
    def edge_runs(cover, minimum=30, depth=6):
        """Stretches of each play-area edge that a 0..1 cover reaches: {side: [(lo, hi), ...]}."""
        lines = {'top': cover[:depth].mean(axis=0), 'bottom': cover[-depth:].mean(axis=0),
                 'left': cover[:, :depth].mean(axis=1), 'right': cover[:, -depth:].mean(axis=1)}
        out = {}
        for side, line in lines.items():
            on = np.concatenate([[False], line > .5, [False]])
            starts = np.nonzero(on[1:] & ~on[:-1])[0]
            ends = np.nonzero(~on[1:] & on[:-1])[0]
            out[side] = [(int(a), int(b)) for a, b in zip(starts, ends) if b - a >= minimum]
        return out

    @staticmethod
    def opaque_window(src, size=128):
        """A fully opaque square of one of the arena's layer pictures (RGB), for a texture sample."""
        sprite = np.array(Image.open(C.ROOT / src).convert('RGBA')).astype(np.float32)
        solid = (sprite[..., 3] > 250).astype(np.float32)
        size = min(size, sprite.shape[0], sprite.shape[1])
        while size >= 24:
            fill = cv2.boxFilter(solid, -1, (size, size), normalize=True, anchor=(0, 0), borderType=cv2.BORDER_CONSTANT)
            fill = fill[:sprite.shape[0] - size + 1, :sprite.shape[1] - size + 1]
            y, x = np.unravel_index(int(np.argmax(fill)), fill.shape)
            if fill[y, x] > .995:
                return sprite[y:y + size, x:x + size, :3]
            size = int(size * .8)
        raise ValueError('NO_OPAQUE_WINDOW')

    @staticmethod
    def detail_map(patch, path, size=256, gain=1.0):
        """Save a patch's light-and-dark as a tiling detail map around mid grey (for kit.ramp(picture=...))."""
        luma = patch.mean(axis=2)
        luma = luma - cv2.GaussianBlur(luma, (0, 0), 24) + float(luma.mean())
        rel = np.clip(.5 * (1 + gain * (luma / max(1e-6, float(luma.mean())) - 1)), 0, 1)
        # Quilt the patch up to the tile size, then wrap its edges so it repeats without a seam.
        rng = np.random.default_rng(7)
        block = min(rel.shape[0], rel.shape[1], 72)
        overlap = block // 3
        ramp = np.minimum(np.arange(block) + 1, overlap) / overlap
        window = np.outer(np.minimum(ramp, ramp[::-1]), np.minimum(ramp, ramp[::-1])).astype(np.float32)
        total = np.zeros((size, size), dtype=np.float32)
        weight = np.zeros((size, size), dtype=np.float32)
        step = block - overlap
        for y in range(0, size, step):
            for x in range(0, size, step):
                py = int(rng.integers(0, rel.shape[0] - block + 1))
                px = int(rng.integers(0, rel.shape[1] - block + 1))
                ys = (y + np.arange(block)) % size
                xs = (x + np.arange(block)) % size
                total[np.ix_(ys, xs)] += rel[py:py + block, px:px + block] * window
                weight[np.ix_(ys, xs)] += window
        tile = total / np.maximum(weight, 1e-6)
        # feathering lowers contrast: restore the patch's own spread
        tile = .5 + (tile - float(tile.mean())) * (float(rel.std()) / max(1e-6, float(tile.std())))
        Image.fromarray((np.clip(tile, 0, 1) * 255 + .5).astype(np.uint8)).save(path)
        return str(path)

    @staticmethod
    def tones(patch, low=15, high=85):
        """A patch's shade and lit colours (the mean of its darkest and of its lightest pixels)."""
        flat = patch.reshape(-1, 3)
        luma = flat.mean(axis=1)
        lo, hi = np.percentile(luma, [low, high])
        return [round(float(v)) for v in flat[luma <= lo].mean(axis=0)], [round(float(v)) for v in flat[luma >= hi].mean(axis=0)]

    # ------------------------------------------------------------------ textures

    @staticmethod
    def flatten(patch, sigma=40.0):
        """Keep a patch's fine texture, drop its broad light and shade."""
        low = cv2.GaussianBlur(patch, (0, 0), sigma)
        return (patch - low + patch.reshape(-1, 3).mean(axis=0, dtype=np.float64)).astype(np.float32)

    def quilt(self, patches, block=128, overlap=40, seed=0, flatten=True, flip=True, size=None):
        """Canvas-sized texture quilted from random blocks of the patches, feathered where they overlap."""
        h, w = size or (self.h, self.w)
        rng = np.random.default_rng(seed)
        sources = [self.flatten(p) if flatten else p for p in patches]
        if flatten:      # one common tone, or blocks from a darker patch show as a checker
            tone = np.mean([p.reshape(-1, 3).mean(axis=0, dtype=np.float64) for p in sources], axis=0)
            sources = [(p + (tone - p.reshape(-1, 3).mean(axis=0, dtype=np.float64))).astype(np.float32) for p in sources]
        block = min([block] + [min(p.shape[0], p.shape[1]) for p in sources])
        overlap = min(overlap, block // 3)
        ramp = np.minimum(np.arange(block) + 1, overlap) / overlap
        ramp = np.minimum(ramp, ramp[::-1])
        window = np.outer(ramp, ramp).astype(np.float32)[..., None]
        step = block - overlap
        total = np.zeros((h + 2 * block, w + 2 * block, 3), dtype=np.float32)
        weight = np.zeros((h + 2 * block, w + 2 * block, 1), dtype=np.float32)
        for y in range(-overlap, h, step):
            for x in range(-overlap, w, step):
                src = sources[int(rng.integers(len(sources)))]
                py = int(rng.integers(0, src.shape[0] - block + 1))
                px = int(rng.integers(0, src.shape[1] - block + 1))
                piece = src[py:py + block, px:px + block]
                if flip and rng.random() < .5:
                    piece = piece[:, ::-1]
                yy, xx = y + overlap, x + overlap
                total[yy:yy + block, xx:xx + block] += piece * window
                weight[yy:yy + block, xx:xx + block] += window
        out = total / np.maximum(weight, 1e-6)
        return out[overlap:overlap + h, overlap:overlap + w]

    def grid(self, x0, y0, x1, y1, source='base'):
        """Continue a regular floor: the rectangle repeats on its own grid, in step with the picture.

        The rectangle must be a whole number of the floor's periods, so inside the play area the
        result equals the picture there and the joints run on unbroken across every seam.
        """
        tile = getattr(self, source)[y0:y1, x0:x1]
        th, tw = tile.shape[:2]
        ys = (np.arange(self.h) + C.Y0 - y0) % th
        xs = (np.arange(self.w) + C.X0 - x0) % tw
        return tile[ys][:, xs].copy()

    def flat(self, rgb):
        return np.broadcast_to(np.array(rgb, dtype=np.float32), (self.h, self.w, 3)).copy()

    def noise(self, sigma, seed=0, octaves=1):
        """Smooth noise in -1..1 (canvas sized): broad light-and-shade so a quilt does not read as tiles."""
        rng = np.random.default_rng(seed)
        out = np.zeros((self.h, self.w), dtype=np.float32)
        amplitude, total = 1.0, 0.0
        for k in range(octaves):
            s = sigma / (2 ** k)
            small = rng.normal(0, 1, (self.h // 8 + 2, self.w // 8 + 2)).astype(np.float32)
            field = cv2.resize(cv2.GaussianBlur(small, (0, 0), max(.5, s / 8)), (self.w, self.h), interpolation=cv2.INTER_CUBIC)
            out += amplitude * field / (float(field.std()) + 1e-6)
            total += amplitude
            amplitude *= .5
        return np.clip(out / total / 2.0, -1, 1)

    # ------------------------------------------------------------------ shapes

    def canvas_xy(self, points):
        return [(x - C.X0, y - C.Y0) for x, y in points]

    def mask(self, points, feather=0.0, supersample=2):
        """Polygon (base pixels) as a 0..1 mask, optionally with a soft edge."""
        s = supersample
        image = Image.new('L', (self.w * s, self.h * s), 0)
        ImageDraw.Draw(image).polygon([(x * s, y * s) for x, y in self.canvas_xy(points)], fill=255)
        mask = np.array(image.resize((self.w, self.h), Image.LANCZOS)).astype(np.float32) / 255.0
        return cv2.GaussianBlur(mask, (0, 0), feather) if feather > 0 else mask

    def blob(self, cx, cy, rx, ry, seed=0, rough=.22, lobes=5, feather=3.0):
        """An organic patch (a puddle of soil, a clearing): an ellipse with a wavering edge."""
        points = []
        phases = [C.hash01(seed, 'p', k) * 6.283 for k in range(lobes)]
        for i in range(72):
            t = i / 72 * 6.283
            r = 1.0 + sum(rough / (k + 1) * np.sin((k + 2) * t + phases[k]) for k in range(lobes))
            points.append((cx + rx * r * np.cos(t), cy + ry * r * np.sin(t)))
        return self.mask(points, feather)

    def band(self, polyline, width, feather=2.0):
        """A path of constant width (a kerb, a track) as a mask."""
        image = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(image).line(self.canvas_xy(polyline), fill=255, width=int(round(width)), joint='curve')
        mask = np.array(image).astype(np.float32) / 255.0
        return cv2.GaussianBlur(mask, (0, 0), feather) if feather > 0 else mask

    @staticmethod
    def tone(image):
        """Mean colour (summed in float64: a float32 mean over a whole canvas drifts by several levels)."""
        return image.reshape(-1, 3).mean(axis=0, dtype=np.float64)

    @classmethod
    def set_tone(cls, image, rgb):
        """Shift a texture so its mean colour is ``rgb``."""
        return image + (np.asarray(rgb, dtype=np.float64) - cls.tone(image)).astype(np.float32)

    @staticmethod
    def mix(under, over, mask):
        return under * (1 - mask[..., None]) + over * mask[..., None]

    @staticmethod
    def shade(image, amount):
        """Multiply by (1 + amount); amount is a canvas-sized field or a number."""
        factor = 1 + (amount[..., None] if hasattr(amount, 'shape') else amount)
        return image * factor

    def edge_mean(self, side, lo, hi, depth=24, source='reference'):
        """Mean colour of a stretch of the play area's edge (to check a texture's tone against it)."""
        img = getattr(self, source)
        if side == 'top':
            region = img[:depth, lo:hi]
        elif side == 'bottom':
            region = img[-depth:, lo:hi]
        elif side == 'left':
            region = img[lo:hi, :depth]
        else:
            region = img[lo:hi, -depth:]
        return region.reshape(-1, 3).mean(axis=0, dtype=np.float64)
