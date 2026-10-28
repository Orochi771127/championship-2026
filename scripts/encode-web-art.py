"""Web encoding for painted or rendered art (maps, illustrations); never for pixel art.

Each source is encoded as lossy WebP (sharp YUV, method 6, alpha kept lossless and exact) at the lowest
quality tier that meets the gate, measured as seen: both images composited over mid grey, PSNR over RGB
and luma SSIM (8 px windows). The default gate (38 dB, 0.985) is for maps that fill the screen; detailed
illustrations pass --min-psnr 34 --min-ssim 0.99. A source that misses every tier, or would grow, is kept. Outputs keep the source's content naming: a name
ending in .<16 hex>.webp keeps its prefix with the new hash, any other is named <sha256>.webp. The
receipt records each source and result so a later pass can be checked or redone.

Usage: python scripts/encode-web-art.py --out DIR --receipt FILE [--min-psnr DB --min-ssim S] SRC [SRC ...]
Needs ImageMagick (`magick`) with WebP support.
"""
import argparse, hashlib, io, json, pathlib, re, subprocess, sys, tempfile
import numpy as np
from PIL import Image

TIERS = (92, 95, 98)


def ssim(a, b):
    k1, k2, L = 0.01, 0.03, 255.0
    h, w = (a.shape[0] // 8) * 8, (a.shape[1] // 8) * 8
    if not h or not w:
        return 1.0
    A = a[:h, :w].reshape(h // 8, 8, w // 8, 8).swapaxes(1, 2).reshape(-1, 64)
    B = b[:h, :w].reshape(h // 8, 8, w // 8, 8).swapaxes(1, 2).reshape(-1, 64)
    ma, mb, va, vb = A.mean(1), B.mean(1), A.var(1), B.var(1)
    cov = ((A - ma[:, None]) * (B - mb[:, None])).mean(1)
    c1, c2 = (k1 * L) ** 2, (k2 * L) ** 2
    return float((((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma ** 2 + mb ** 2 + c1) * (va + vb + c2))).mean())


def luma(x):
    return 0.299 * x[..., 0] + 0.587 * x[..., 1] + 0.114 * x[..., 2]


def over_grey(rgba):
    x = rgba.astype(np.float64)
    a = x[..., 3:4] / 255.0
    return x[..., :3] * a + 128.0 * (1 - a)


def measure(ref, data):
    out = np.asarray(Image.open(io.BytesIO(data)).convert('RGBA'))
    if out.shape != ref.shape:
        return 0.0, 0.0, False
    a, b = over_grey(ref), over_grey(out)
    mse = float(((a - b) ** 2).mean())
    psnr = 99.0 if mse == 0 else 10 * np.log10(255 ** 2 / mse)
    return psnr, ssim(luma(a), luma(b)), bool(np.array_equal(ref[..., 3], out[..., 3]))


def encode(ref, quality):
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = pathlib.Path(tmp) / 'in.png', pathlib.Path(tmp) / 'out.webp'
        Image.fromarray(ref).save(src)
        subprocess.run(['magick', str(src), '-quality', str(quality), '-define', 'webp:use-sharp-yuv=true',
                        '-define', 'webp:alpha-quality=100', '-define', 'webp:exact=true', '-define', 'webp:method=6', str(dst)],
                       check=True)
        return dst.read_bytes()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True)
    parser.add_argument('--receipt', required=True)
    parser.add_argument('--min-psnr', type=float, default=38.0)
    parser.add_argument('--min-ssim', type=float, default=0.985)
    parser.add_argument('sources', nargs='+')
    args = parser.parse_args()
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for name in args.sources:
        path = pathlib.Path(name)
        raw = path.read_bytes()
        ref = np.asarray(Image.open(io.BytesIO(raw)).convert('RGBA'))
        row = {'source': path.as_posix(), 'sourceSha256': hashlib.sha256(raw).hexdigest(), 'sourceBytes': len(raw)}
        for quality in TIERS:
            data = encode(ref, quality)
            psnr, score, alpha = measure(ref, data)
            if psnr >= args.min_psnr and score >= args.min_ssim and alpha and len(data) < len(raw):
                digest = hashlib.sha256(data).hexdigest()
                prefix = re.match(r'^(.*)\.[0-9a-f]{16}\.webp$', path.name)
                target = out / (f'{prefix[1]}.{digest[:16]}.webp' if prefix else f'{digest}.webp')
                target.write_bytes(data)
                row.update(output=target.as_posix(), sha256=digest, bytes=len(data), quality=quality,
                           psnr=round(psnr, 2), ssim=round(score, 4))
                break
        else:
            row['kept'] = 'NO_TIER_PASSED'
        rows.append(row)
        print(f"{path.name[:24]:24} {len(raw)/1e6:6.2f} MB -> " + (f"{row['bytes']/1e6:5.2f} MB q{row['quality']} "
              f"psnr {row['psnr']} ssim {row['ssim']}" if 'sha256' in row else 'kept'), flush=True)
    receipt = {'schemaVersion': 1, 'tool': 'scripts/encode-web-art.py', 'tiers': list(TIERS),
               'gate': {'measuredOver': 'mid grey composite', 'minPsnrDb': args.min_psnr, 'minLumaSsim': args.min_ssim,
                        'alpha': 'exact'}, 'files': rows,
               'sourceBytes': sum(r['sourceBytes'] for r in rows),
               'outputBytes': sum(r.get('bytes', r['sourceBytes']) for r in rows)}
    pathlib.Path(args.receipt).write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(f"total {receipt['sourceBytes']/1e6:.1f} MB -> {receipt['outputBytes']/1e6:.1f} MB", flush=True)


if __name__ == '__main__':
    sys.exit(main())
