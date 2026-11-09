"""Compare the same frames of two renders and say where they differ.

  python scripts/dev/frame-diff.py A.mp4 B.mp4 --frames 150,558 [--out diff-dir] [--box x0,y0,x1,y1]

For each frame: mean absolute difference (0..255) over the whole frame, the
share of pixels that changed by more than 12 levels, the bounding box of
those pixels, and (with --box) the same numbers inside and outside a region.
Writes A | B | amplified difference images when --out is given.
Used to check that an edit to a shot config shows up in the MP4 where it
should, and nowhere else (docs/STYLE_LAB_V2.md).
"""
import argparse
import os
import subprocess
import sys

import numpy as np
from PIL import Image


def grab(video, frame, path):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vf', f'select=eq(n\\,{frame})', '-frames:v', '1', path], check=True)
    return np.asarray(Image.open(path).convert('RGB')).astype(np.int16)


def stats(a, b):
    d = np.abs(a - b).max(axis=2)
    changed = d > 12
    ys, xs = np.nonzero(changed)
    box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(xs) else None
    return float(np.abs(a - b).mean()), float(changed.mean()), box, d


def main():
    p = argparse.ArgumentParser()
    p.add_argument('a')
    p.add_argument('b')
    p.add_argument('--frames', required=True)
    p.add_argument('--out')
    p.add_argument('--box')
    args = p.parse_args()
    out = args.out or os.path.join(os.path.dirname(os.path.abspath(args.a)), 'frame-diff')
    os.makedirs(out, exist_ok=True)
    for f in [int(x) for x in args.frames.split(',')]:
        A = grab(args.a, f, os.path.join(out, f'a-{f}.png'))
        B = grab(args.b, f, os.path.join(out, f'b-{f}.png'))
        mean, share, box, d = stats(A, B)
        line = f'frame {f}: mean |A-B| {mean:.2f}, changed pixels {share * 100:.1f}%, changed box {box}'
        if args.box:
            x0, y0, x1, y1 = [int(v) for v in args.box.split(',')]
            inside = np.zeros(d.shape, bool)
            inside[y0:y1, x0:x1] = True
            ch = d > 12
            line += f' | inside box {ch[inside].mean() * 100:.1f}% changed, outside {ch[~inside].mean() * 100:.2f}%'
        print(line)
        amp = np.clip(d * 6, 0, 255).astype(np.uint8)
        strip = np.concatenate([A.astype(np.uint8), B.astype(np.uint8), np.stack([amp, amp, amp], axis=2)], axis=1)
        Image.fromarray(strip).resize((strip.shape[1] // 3, strip.shape[0] // 3)).save(os.path.join(out, f'diff-{f}.jpg'), quality=88)
    return 0


if __name__ == '__main__':
    sys.exit(main())
