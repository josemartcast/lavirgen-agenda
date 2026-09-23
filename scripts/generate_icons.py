"""Genera los iconos PWA definitivos de La Virgen desde el monograma del brand board.

Monograma: ovalo carbon #2E2E2A con 'L' serif y arco terracota #C98F7A sobre fondo arena #EDE6DD.
Salida: public/icons/{icon-192, icon-512, icon-maskable-512, apple-touch-icon}.png
"""
from PIL import Image, ImageDraw, ImageFont
import os

ARENA = (0xED, 0xE6, 0xDD)
CARBON = (0x2E, 0x2E, 0x2A)
TERRACOTA_SUAVE = (0xC9, 0x8F, 0x7A)

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(OUT, exist_ok=True)

# Fuente serif disponible en Windows (proxy de Cormorant Garamond)
FONT_CANDIDATES = [
    "C:/Windows/Fonts/georgiab.ttf",  # Georgia Bold
    "C:/Windows/Fonts/georgia.ttf",
    "C:/Windows/Fonts/timesbd.ttf",
]

def load_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def draw_monogram(size, content_scale=1.0):
    """Dibuja el monograma LAVIRGEN a `size` px. content_scale reduce el contenido
    (para maskable safe zone). Devuelve una Image RGB."""
    img = Image.new("RGB", (size, size), ARENA)
    d = ImageDraw.Draw(img)

    cx, cy = size / 2, size / 2

    # --- Ovalo carbon ---
    # El ovalo del brand es vertical, proporcion alto:ancho ~ 1.55
    ow = size * 0.52 * content_scale
    oh = size * 0.80 * content_scale
    stroke = max(2, round(size * 0.018 * content_scale))
    d.ellipse([cx - ow / 2, cy - oh / 2, cx + ow / 2, cy + oh / 2],
              outline=CARBON, width=stroke)

    # --- Letra L serif carbon ---
    font_size = round(size * 0.46 * content_scale)
    font = load_font(font_size)
    bbox = d.textbbox((0, 0), "L", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    # La L ligeramente por encima del centro (como en el monograma)
    tx = cx - tw / 2 - bbox[0]
    ty = cy - th / 2 - bbox[1] - size * 0.02 * content_scale
    d.text((tx, ty), "L", font=font, fill=CARBON)

    # --- Arco terracota cruzando la L (curva tipo tilde/onda) ---
    # El arco del monograma es una curva suave que atraviesa la L de izq a dercha,
    # ligeramente ascendente. Lo dibujamos como serie de puntos de una curva cubica.
    aw = size * 0.34 * content_scale          # semianchura del arco
    ay = cy - size * 0.01 * content_scale     # altura media del arco
    amp = size * 0.075 * content_scale        # amplitud vertical
    arc_stroke = max(2, round(size * 0.022 * content_scale))

    pts = []
    steps = 60
    for i in range(steps + 1):
        t = i / steps
        x = cx - aw + 2 * aw * t
        # Curva suave: senoide de media onda (sube y baja), sesgada ascendente
        import math
        y = ay - amp * math.sin(math.pi * t) - size * 0.02 * content_scale * (t - 0.5)
        pts.append((x, y))
    d.line(pts, fill=TERRACOTA_SUAVE, width=arc_stroke, joint="curve")

    return img

def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path, "PNG", optimize=True)
    print(f"  {name}: {img.size[0]}x{img.size[1]} ({os.path.getsize(path)} bytes)")

if __name__ == "__main__":
    print("Generando iconos PWA — La Virgen (monograma)")
    # Iconos estandar (contenido completo)
    save(draw_monogram(192), "icon-192.png")
    save(draw_monogram(512), "icon-512.png")
    # Maskable: contenido al 68% para respetar safe zone circular (80%)
    save(draw_monogram(512, content_scale=0.68), "icon-maskable-512.png")
    # Apple touch icon 180x180 (iPhone)
    save(draw_monogram(180), "apple-touch-icon.png")
    print("OK")
