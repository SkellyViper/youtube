"""Annotate reference frames for a style guide (docs only; not part of any render).

  python scripts/dev/annotate.py <notes.json>

notes.json:
  {"out": "docs/video-01/img", "width": 1600,
   "frames": [{"src": "path/to/frame.png", "name": "ref-01-wide.jpg",
               "notes": [{"at": [x, y], "label": [x, y], "text": "..."}]}],
   "pairs":  [{"name": "before-after-wide.jpg", "before": "a.png", "after": "b.png",
               "crop": [x, y, w, h], "captions": ["Approved render", "Corrected"]}]}

Coordinates are pixels in the source frame (1920x1080). A note draws a ring at
`at`, a hairline to `label`, and the text on a dark plate there (use "\\n" for
line breaks). Pairs are cropped side by side with a caption strip.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

BLUE = (166, 214, 255)
PLATE = (4, 5, 10)
TEXT = (234, 242, 255)
DIM = (140, 152, 184)


def font(size):
    for path in ('C:/Windows/Fonts/segoeui.ttf', '/System/Library/Fonts/Helvetica.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def annotate(frame, width):
    im = Image.open(frame['src']).convert('RGB')
    k = width / im.width
    im = im.resize((width, round(im.height * k)), Image.LANCZOS)
    d = ImageDraw.Draw(im, 'RGBA')
    f = font(round(21 * width / 1600))
    pad = round(9 * width / 1600)
    for n in frame.get('notes', []):
        lx, ly = n['label'][0] * k, n['label'][1] * k
        box = d.multiline_textbbox((0, 0), n['text'], font=f, spacing=5)
        w, h = box[2] - box[0], box[3] - box[1]
        # The plate starts at the label point and extends to the right ("side": "left" = ends at the label point).
        left = lx - w - pad * 2 if n.get('side') == 'left' else lx
        plate = (left, ly - h / 2 - pad, left + w + pad * 2, ly + h / 2 + pad)
        if 'at' in n:
            ax, ay = n['at'][0] * k, n['at'][1] * k
            anchor = (plate[0] if ax < plate[0] else plate[2], ly) if not (plate[0] <= ax <= plate[2]) else (min(max(ax, plate[0]), plate[2]), plate[1] if ay < plate[1] else plate[3])
            d.line((ax, ay, anchor[0], anchor[1]), fill=BLUE + (210,), width=2)
            r = 7 * width / 1600
            d.ellipse((ax - r, ay - r, ax + r, ay + r), outline=BLUE + (255,), width=2)
        d.rectangle(plate, fill=PLATE + (225,), outline=BLUE + (120,), width=1)
        d.multiline_text((plate[0] + pad, plate[1] + pad - box[1]), n['text'], font=f, fill=TEXT, spacing=5)
    return im


def pair(p, width):
    x, y, w, h = p['crop']
    gap = 12
    cell = (width - gap) // 2
    ch = round(cell * h / w)
    strip = 44
    out = Image.new('RGB', (width, ch + strip), PLATE)
    d = ImageDraw.Draw(out)
    f = font(20)
    for i, key in enumerate(('before', 'after')):
        im = Image.open(p[key]).convert('RGB')
        # Sources may be at different scales: the crop is given in 1920x1080 space.
        s = im.width / 1920
        tile = im.crop((round(x * s), round(y * s), round((x + w) * s), round((y + h) * s))).resize((cell, ch), Image.LANCZOS)
        ox = i * (cell + gap)
        out.paste(tile, (ox, 0))
        d.text((ox + 4, ch + 10), p.get('captions', ['Approved render', 'Corrected'])[i], font=f, fill=TEXT if i else DIM)
    return out


def main():
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    out_dir = spec['out']
    width = spec.get('width', 1600)
    os.makedirs(out_dir, exist_ok=True)
    for fr in spec.get('frames', []):
        annotate(fr, width).save(os.path.join(out_dir, fr['name']), quality=88)
        print('annotated', fr['name'])
    for p in spec.get('pairs', []):
        pair(p, width).save(os.path.join(out_dir, p['name']), quality=88)
        print('pair', p['name'])


if __name__ == '__main__':
    main()
