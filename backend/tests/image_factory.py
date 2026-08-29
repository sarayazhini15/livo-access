"""Generate realistic feature-rich test images (JPEG) as base64 for vision endpoints."""
import base64
import io
import random
from PIL import Image, ImageDraw, ImageFont


def _font(size=20):
    for path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def _to_b64_jpeg(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=88)
    return base64.b64encode(buf.getvalue()).decode()


def make_receipt(items, subtotal, tax, total, merchant="SHREE KIRANA STORE",
                 date="15/01/2026") -> str:
    """Render a realistic printed thermal-receipt style image."""
    W, H = 520, 820
    img = Image.new("RGB", (W, H), (250, 248, 240))
    d = ImageDraw.Draw(img)
    # add subtle noise/texture for feature richness
    rnd = random.Random(42)
    for _ in range(2500):
        x, y = rnd.randint(0, W - 1), rnd.randint(0, H - 1)
        c = rnd.randint(200, 245)
        d.point((x, y), fill=(c, c, c))

    title_font = _font(28)
    hdr_font = _font(18)
    mono = _font(20)
    small = _font(16)

    y = 20
    d.text((W // 2 - 150, y), merchant, fill=(0, 0, 0), font=title_font); y += 40
    d.text((W // 2 - 120, y), "123 Main Road, Bengaluru", fill=(0, 0, 0), font=small); y += 22
    d.text((W // 2 - 90, y), "GSTIN: 29ABCDE1234F1Z5", fill=(0, 0, 0), font=small); y += 26
    d.line([(20, y), (W - 20, y)], fill=(0, 0, 0), width=2); y += 10
    d.text((30, y), f"Date: {date}   Bill No: 4471", fill=(0, 0, 0), font=hdr_font); y += 28
    d.line([(20, y), (W - 20, y)], fill=(0, 0, 0), width=1); y += 8
    d.text((30, y), "Item                Qty   Rate   Amount", fill=(0, 0, 0), font=mono); y += 26
    d.line([(20, y), (W - 20, y)], fill=(0, 0, 0), width=1); y += 8

    for it in items:
        name = it["name"][:18].ljust(18)
        qty = str(it["quantity"]).rjust(3)
        rate = f"{it['unit_price']:.2f}".rjust(7)
        amt = f"{it['line_total']:.2f}".rjust(8)
        d.text((30, y), f"{name}{qty} {rate} {amt}", fill=(0, 0, 0), font=mono); y += 26

    y += 6
    d.line([(20, y), (W - 20, y)], fill=(0, 0, 0), width=1); y += 12
    d.text((260, y), f"Subtotal:  Rs {subtotal:.2f}", fill=(0, 0, 0), font=mono); y += 26
    d.text((260, y), f"CGST+SGST: Rs {tax:.2f}", fill=(0, 0, 0), font=mono); y += 26
    d.line([(240, y), (W - 20, y)], fill=(0, 0, 0), width=2); y += 6
    d.text((260, y), f"TOTAL:     Rs {total:.2f}", fill=(0, 0, 0), font=_font(22)); y += 40
    d.text((W // 2 - 90, y), "*** THANK YOU, VISIT AGAIN ***",
           fill=(0, 0, 0), font=hdr_font)
    return _to_b64_jpeg(img)


def make_correct_receipt() -> str:
    items = [
        {"name": "Basmati Rice 1kg", "quantity": 2, "unit_price": 120.00, "line_total": 240.00},
        {"name": "Toor Dal 500g",    "quantity": 1, "unit_price":  85.00, "line_total":  85.00},
        {"name": "Sunflower Oil 1L", "quantity": 1, "unit_price": 175.00, "line_total": 175.00},
    ]
    subtotal = 500.00
    tax = 25.00  # 5% GST
    total = 525.00
    return make_receipt(items, subtotal, tax, total)


def make_wrong_math_receipt() -> str:
    # subtotal + tax = 420 but total printed as 500 (mismatch of 80)
    items = [
        {"name": "Milk 1L",     "quantity": 2, "unit_price":  60.00, "line_total": 120.00},
        {"name": "Bread Loaf",  "quantity": 1, "unit_price":  40.00, "line_total":  40.00},
        {"name": "Eggs 6pc",    "quantity": 1, "unit_price":  60.00, "line_total":  60.00},
        {"name": "Butter 100g", "quantity": 1, "unit_price": 180.00, "line_total": 180.00},
    ]
    subtotal = 400.00
    tax = 20.00
    total = 500.00  # WRONG on purpose
    return make_receipt(items, subtotal, tax, total,
                        merchant="DAILY NEEDS MART", date="12/01/2026")


def make_random_photo() -> str:
    """Non-bill image: colorful abstract shapes (feature-rich, not solid)."""
    W, H = 480, 480
    img = Image.new("RGB", (W, H), (30, 80, 130))
    d = ImageDraw.Draw(img)
    rnd = random.Random(7)
    for _ in range(60):
        x1, y1 = rnd.randint(0, W), rnd.randint(0, H)
        x2, y2 = x1 + rnd.randint(20, 140), y1 + rnd.randint(20, 140)
        col = (rnd.randint(0, 255), rnd.randint(0, 255), rnd.randint(0, 255))
        shape = rnd.choice(["rect", "ellipse", "line"])
        if shape == "rect":
            d.rectangle([x1, y1, x2, y2], fill=col, outline=(0, 0, 0))
        elif shape == "ellipse":
            d.ellipse([x1, y1, x2, y2], fill=col, outline=(0, 0, 0))
        else:
            d.line([x1, y1, x2, y2], fill=col, width=rnd.randint(2, 8))
    for _ in range(3000):
        x, y = rnd.randint(0, W - 1), rnd.randint(0, H - 1)
        d.point((x, y), fill=(rnd.randint(0, 255),) * 3)
    return _to_b64_jpeg(img)


# --- Cash images ---
_NOTE_COLORS = {
    10:  ((180, 120, 80),  (140, 90, 60)),   # brown
    20:  ((180, 180, 100), (140, 140, 70)),  # greenish yellow
    50:  ((100, 160, 200), (70, 120, 160)),  # blue/cyan
    100: ((150, 130, 190), (110, 90, 150)),  # violet
    200: ((220, 170, 90),  (180, 130, 60)),  # yellow-orange
    500: ((150, 150, 150), (110, 110, 110)), # grey
    2000:((220, 130, 190), (180, 90, 150)),  # magenta
}


def _draw_note(canvas: Image.Image, x: int, y: int, denom: int) -> None:
    W, H = 260, 130
    c1, c2 = _NOTE_COLORS.get(denom, ((200, 200, 200), (150, 150, 150)))
    note = Image.new("RGB", (W, H), c1)
    d = ImageDraw.Draw(note)
    # gradient stripes for texture / features
    for i in range(0, W, 4):
        shade = int(255 * (i / W))
        d.line([(i, 0), (i, H)], fill=(
            max(0, c1[0] - 30) + shade // 10,
            max(0, c1[1] - 30) + shade // 12,
            max(0, c1[2] - 30) + shade // 14,
        ))
    # borders
    d.rectangle([2, 2, W - 3, H - 3], outline=(20, 20, 20), width=2)
    d.rectangle([8, 8, W - 9, H - 9], outline=c2, width=1)
    # portrait circle (Gandhi placeholder)
    d.ellipse([W - 90, 25, W - 20, 105], fill=(230, 220, 200), outline=(60, 40, 30), width=2)
    d.ellipse([W - 78, 40, W - 32, 90], fill=(200, 180, 150))
    # denomination text (multiple places, like real notes)
    d.text((14, 12), str(denom), fill=(0, 0, 0), font=_font(30))
    d.text((14, 55), f"Rs {denom}", fill=(0, 0, 0), font=_font(22))
    d.text((14, 90), "RESERVE BANK OF INDIA", fill=(0, 0, 0), font=_font(11))
    d.text((W - 60, H - 22), str(denom), fill=(0, 0, 0), font=_font(18))
    # security thread
    d.line([(W // 2, 10), (W // 2, H - 10)], fill=(50, 50, 50), width=2)
    canvas.paste(note, (x, y))


def make_cash_image(denoms: list[int]) -> str:
    """Render a table-top style image with the given note denominations."""
    W, H = 700, 700
    img = Image.new("RGB", (W, H), (35, 90, 45))  # green tabletop
    d = ImageDraw.Draw(img)
    # tabletop texture
    rnd = random.Random(3)
    for _ in range(5000):
        x, y = rnd.randint(0, W - 1), rnd.randint(0, H - 1)
        g = rnd.randint(25, 110)
        d.point((x, y), fill=(20, g, 30))
    positions = [(30, 30), (370, 30), (30, 190), (370, 190),
                 (30, 350), (370, 350), (30, 510), (370, 510)]
    for i, denom in enumerate(denoms[:8]):
        x, y = positions[i]
        _draw_note(img, x, y, denom)
    return _to_b64_jpeg(img)


def make_no_cash_image() -> str:
    """Feature-rich non-cash photo (wooden desk-ish scene)."""
    W, H = 480, 480
    img = Image.new("RGB", (W, H), (120, 80, 40))
    d = ImageDraw.Draw(img)
    rnd = random.Random(11)
    # wood grain
    for y in range(H):
        shade = 90 + int(30 * (0.5 + 0.5 * ((y * 0.05) % 1)))
        d.line([(0, y), (W, y)], fill=(shade + 30, shade, shade - 30))
    for _ in range(200):
        x1, y1 = rnd.randint(0, W), rnd.randint(0, H)
        d.arc([x1 - 40, y1 - 8, x1 + 40, y1 + 8], 0, 360,
              fill=(80, 55, 25), width=1)
    # a mug
    d.ellipse([180, 200, 320, 260], fill=(240, 240, 235), outline=(0, 0, 0), width=2)
    d.rectangle([180, 230, 320, 380], fill=(240, 240, 235), outline=(0, 0, 0), width=2)
    d.ellipse([180, 360, 320, 400], fill=(200, 200, 195), outline=(0, 0, 0), width=2)
    d.ellipse([315, 260, 370, 340], outline=(0, 0, 0), width=6)
    return _to_b64_jpeg(img)
