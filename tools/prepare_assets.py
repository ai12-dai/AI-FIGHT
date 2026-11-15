"""Prepare game assets from the original art in source-art/.

Characters: clean the alpha channel, trim to the figure, scale to a fixed
height, save PNG.
Arenas: re-encode to a web-friendly size (the Skynet art has a mock HUD baked
into its top edge, which is cropped off).

Run:  python3 tools/prepare_assets.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "source-art"
OUT_F = ROOT / "client/public/assets/fighters"
OUT_A = ROOT / "client/public/assets/arenas"

FIGHTERS = {1: "deadline", 2: "crimson_fan", 3: "chain_sailor", 4: "neko_shadow",
            5: "iron_kai", 6: "ceo_strike", 7: "shinobi", 8: "street_king"}
ARENAS = {9: "skynet_square", 10: "sakura_dojo", 11: "neon_boardroom"}
TARGET_H = 640


def cut(img):
    """Source sprites already carry alpha; clean faint noise, trim, scale."""
    rgba = img.convert("RGBA")
    a = np.asarray(rgba).copy()
    al = a[..., 3]
    al[al < 24] = 0          # stray near-invisible noise around the figure
    al[al > 200] = 255       # solid body fully opaque
    rgba = Image.fromarray(a)
    bbox = rgba.getchannel("A").getbbox()
    rgba = rgba.crop((max(0, bbox[0]-4), max(0, bbox[1]-4), bbox[2]+4, bbox[3]+4))
    s = TARGET_H / rgba.height
    return rgba.resize((round(rgba.width * s), TARGET_H), Image.LANCZOS)


for i, name in FIGHTERS.items():
    out = cut(Image.open(SRC / f"{i}.webp"))
    out.save(OUT_F / f"{name}.png", optimize=True)
    print(name, out.size)

for i, name in ARENAS.items():
    im = Image.open(SRC / f"{i}.webp").convert("RGB")
    if name == "skynet_square":
        # this art has a mock HUD painted into the top; crop it off, keep 16:9
        top = round(im.height * 0.135)
        h = im.height - top
        w = round(h * 16 / 9)
        x0 = (im.width - w) // 2
        im = im.crop((x0, top, x0 + w, im.height))
    im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
    im.save(OUT_A / f"{name}.jpg", quality=90)
    im.resize((480, round(im.height * 480 / im.width)), Image.LANCZOS).save(OUT_A / f"{name}_thumb.jpg", quality=85)
    print(name, im.size)
