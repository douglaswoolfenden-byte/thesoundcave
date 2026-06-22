"""
Embers — animation engine (Firepit "Motion" format). Brings a finished static artwork to life
with bug-free CODE motion (no generative video): the user uploads art + types an instruction,
the instruction maps to an effect, and we render a seamless looping mp4.

Effects palette (in-place, region-maskable): holo · prism · glow · flicker · sweep · sparkle ·
ripple · scan. Plus the subject-transform effect `fall` (cut the figure, drop it top->bottom on
a loop over the artwork; the vacated hole is filled with FLUX Fill so the original art is kept).

Ported from the proven local prototype (scratch/embers_local/motion.py, 2026-06-22). Returns mp4
BYTES so content_api can persist via media_gen.save_video (reuses existing storage + credits).

Dependencies: numpy, Pillow, ffmpeg (already used by the video tier), FAL_KEY (birefnet + FLUX Fill).
"""
import os, io, base64, subprocess, tempfile
import numpy as np
import requests
from PIL import Image, ImageFilter

FAL = "https://fal.run"


def _fal_key():
    key = os.getenv("FAL_KEY")
    if key:
        return key
    try:                                            # standalone/dev: load workspace-root .env
        from dotenv import load_dotenv
        here = os.path.dirname(os.path.abspath(__file__))
        for up in (1, 2, 3):
            p = os.path.join(here, *([".."] * up), ".env")
            if os.path.exists(p):
                load_dotenv(p); break
    except Exception:
        pass
    return os.getenv("FAL_KEY")


# ---- colour helper -------------------------------------------------------
def _hsv2rgb(h, s, v):
    h6 = (h % 1.0) * 6.0
    i = np.floor(h6).astype(int) % 6
    f = h6 - np.floor(h6)
    p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    r = np.choose(i, [v, q, p, p, t, v])
    g = np.choose(i, [t, v, v, q, p, p])
    b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], -1).astype(np.float32)


# ---- per-frame in-place effects (full-frame HxWx3 float) -----------------
def _holo(base, lum, diag, ph, inten, cyc, freq=2.0, sat=0.85, glint=0.55):
    holo = _hsv2rgb(diag * freq - ph * cyc, np.full_like(diag, sat), np.ones_like(diag))
    out = base * (1 - (inten * (0.25 + 0.75 * lum))[..., None]) + \
        (1 - (1 - base) * (1 - holo)) * (inten * (0.25 + 0.75 * lum))[..., None]
    if glint > 0:
        d = np.abs(diag - (ph * cyc) % 1.0); d = np.minimum(d, 1 - d)
        out = out + np.exp(-(d ** 2) / (2 * 0.012))[..., None] * (glint * inten)
    return out


def _glow(base, lum, ph, inten, cyc):
    g = base * (1 + inten * 0.35 * np.sin(2 * np.pi * ph * cyc))
    grey = base.mean(2, keepdims=True)
    return grey + (g - grey) * (1 + inten * 0.3 * np.sin(2 * np.pi * ph * cyc))


def _flicker(base, ph, inten, cyc):
    f = 0.6 * np.sin(2 * np.pi * ph * cyc) + 0.4 * np.sin(2 * np.pi * ph * cyc * 3 + 1.7)
    return base * (1 + inten * 0.25 * f)


def _sweep(base, diag, ph, inten, cyc):
    d = np.abs(diag - (ph * cyc) % 1.0); d = np.minimum(d, 1 - d)
    return base + np.exp(-(d ** 2) / (2 * 0.02))[..., None] * (0.8 * inten)


def _sparkle(base, ph, inten, cyc, H, W):
    rng = np.random.default_rng(7); n = 60
    ys = rng.integers(0, H, n); xs = rng.integers(0, W, n); offs = rng.random(n)
    field = np.zeros((H, W), np.float32)
    field[ys, xs] = np.clip(np.sin(2 * np.pi * (ph * cyc + offs)), 0, 1) ** 6
    field = np.asarray(Image.fromarray((field * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(2)), np.float32) / 255.0
    return base + field[..., None] * (1.2 * inten)


def _ripple(base, yy, xx, ph, inten, cyc, H, W):
    dx = ((inten * 6.0) * np.sin(2 * np.pi * (yy / (H * 0.12) + ph * cyc))).astype(np.float32)
    return base[yy.astype(int), np.clip((xx + dx).round().astype(int), 0, W - 1)]


def _scan(base, yy, H, ph, inten, cyc):
    out = base * (1 - 0.45 * inten) + (base * np.array([0.55, 1.0, 1.08], np.float32)) * (0.45 * inten)
    out = out * (0.85 + 0.15 * (0.5 + 0.5 * np.sin(yy * np.pi)))[..., None]
    out = out + np.exp(-((yy - ((ph * cyc) % 1.0) * H) ** 2) / (2 * (H * 0.05) ** 2))[..., None] * (0.5 * inten)
    s = max(1, int(round(3 * inten)))
    out[..., 0] = np.roll(out[..., 0], s, 1); out[..., 2] = np.roll(out[..., 2], -s, 1)
    return out


# ---- text -> motion ------------------------------------------------------
_KEYWORDS = [
    ("fall",    ("fall", "falling", "drop", "descend", "plummet", "tumbl", "sink", "fly", "float down")),
    ("holo",    ("holo", "iridesc", "rainbow", "foil", "shimmer", "shine", "metallic", "chrome")),
    ("prism",   ("prism", "chromatic", "spectrum", "oil slick", "petrol")),
    ("glow",    ("glow", "pulse", "breath", "throb", "pulsate", "heartbeat", "radiate")),
    ("flicker", ("flicker", "flash", "strobe", "blink", "neon", "buzz")),
    ("sweep",   ("sweep", "glint", "ray", "streak", "light across", "beam", "gleam", "sheen")),
    ("sparkle", ("sparkle", "twinkle", "glitter", "star", "stardust")),
    ("ripple",  ("ripple", "wave", "wobble", "sway", "undulat", "water", "liquid", "warp", "drift", "float", "smoke", "haze", "flow")),
    ("scan",    ("scan", "hologram", "projection", "crt", "glitch", "vhs", "static")),
]


def parse_instruction(text):
    t = (text or "").lower()
    for motion, keys in _KEYWORDS:
        if any(k in t for k in keys):
            return motion
    return "holo"


# ---- subject isolation + standard hole fill ------------------------------
def _birefnet_cutout(img):
    """Clean subject matte via fal birefnet (figure only, no background). None if unavailable."""
    key = _fal_key()
    if not key:
        return None
    try:
        buf = io.BytesIO(); img.convert("RGB").save(buf, "PNG")
        uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        r = requests.post(f"{FAL}/fal-ai/birefnet/v2",
                          headers={"Authorization": f"Key {key}", "Content-Type": "application/json"},
                          json={"image_url": uri, "output_format": "png"}, timeout=90)
        r.raise_for_status()
        ir = requests.get(r.json()["image"]["url"], timeout=90); ir.raise_for_status()
        return Image.open(io.BytesIO(ir.content)).convert("RGBA")
    except Exception:
        return None


def _inpaint_smooth(img_rgb, mask_L, scale=4, iters=80, radius=4):
    """Fallback hole fill (no fal): diffuse the surrounding background inward at low res."""
    W, H = img_rgb.size
    sw, sh = max(8, W // scale), max(8, H // scale)
    small = img_rgb.resize((sw, sh), Image.LANCZOS)
    smask = mask_L.resize((sw, sh), Image.LANCZOS).point(lambda p: 255 if p > 30 else 0)
    filled = small
    for _ in range(iters):
        filled = Image.composite(filled.filter(ImageFilter.GaussianBlur(radius)), small, smask)
    return Image.composite(filled.resize((W, H), Image.LANCZOS), img_rgb, mask_L).convert("RGB")


def _fill_hole(img, hole_mask):
    """STANDARD fill for subject-removal animations: keep the ORIGINAL artwork exactly; fill ONLY
    the subject's vacated hole with FLUX Fill (Firefly-class generative inpaint -> vibrant, blended).
    Falls back to a smooth diffuse fill if fal is unavailable. Computed once per render."""
    base = img.convert("RGB")
    feath = hole_mask.filter(ImageFilter.GaussianBlur(4))
    key = _fal_key()
    if not key:
        return Image.composite(_inpaint_smooth(base, hole_mask), base, feath)

    def _uri(im, mode="RGB"):
        b = io.BytesIO(); im.convert(mode).save(b, "PNG")
        return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()
    try:
        r = requests.post(f"{FAL}/fal-ai/flux-pro/v1/fill",
                          headers={"Authorization": f"Key {key}", "Content-Type": "application/json"},
                          json={"image_url": _uri(base), "mask_url": _uri(hole_mask, "L"),
                                "prompt": "soft out-of-focus blurred background, smooth even colour, "
                                          "no pattern, no stripes, no rainbow bands, seamless, no person"},
                          timeout=180)
        r.raise_for_status()
        j = r.json(); u = (j.get("images") or [j.get("image")])[0]["url"]
        gen = Image.open(io.BytesIO(requests.get(u, timeout=120).content)).convert("RGB").resize(img.size)
        return Image.composite(gen, base, feath)
    except Exception:
        return Image.composite(_inpaint_smooth(base, hole_mask), base, feath)


# ---- fall (subject-transform) --------------------------------------------
def _render_fall(img, out_path, intensity, speed, duration):
    """ONE figure (clean matte, original colours) floats top->bottom over a LIVING background
    (radial zoom-pulse + rising particles + sway). Clunky/nostalgic: 12fps + film grain."""
    W, H = img.size
    cutout = _birefnet_cutout(img)
    if cutout is None:
        lum = np.asarray(img, np.float32).mean(2)
        m = Image.fromarray(((lum < 95) * 255).astype(np.uint8), "L").filter(ImageFilter.MedianFilter(5))
        cutout = img.convert("RGBA"); cutout.putalpha(m.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5)))

    alpha = cutout.getchannel("A")
    bbox = alpha.getbbox() or (0, 0, W, H)
    fill = alpha.point(lambda p: 255 if p > 20 else 0).filter(ImageFilter.MaxFilter(35))
    bg = _fill_hole(img, fill)

    sub = cutout.crop(bbox)
    x0, sh = bbox[0], sub.height
    travel = H + sh
    cycles = max(1, int(round(speed)))
    out_fps = 12
    nframes = max(2, int(round(max(duration, 6.0) * out_fps)))
    rng = np.random.default_rng(7)
    px = rng.integers(0, W, 55); py0 = rng.random(55); poff = rng.random(55)
    grain = rng.normal(0, 9, (nframes, H, W, 3))

    tmp = tempfile.mkdtemp(prefix="fall_")
    for n in range(nframes):
        ph = n / nframes
        z = 1.0 + 0.035 * (0.5 - 0.5 * np.cos(2 * np.pi * ph))
        zw, zh = int(W * z) // 2 * 2, int(H * z) // 2 * 2
        l, t = (zw - W) // 2, (zh - H) // 2
        frame = bg.resize((zw, zh), Image.LANCZOS).crop((l, t, l + W, t + H))
        frame.paste(sub, (x0 + int(7 * np.sin(2 * np.pi * ph)), int(((ph * cycles) % 1.0) * travel - sh)), sub)
        yy = (((py0 - ph) % 1.0) * H).astype(int) % H
        xx = (px + 6 * np.sin(2 * np.pi * (ph + poff))).astype(int) % W
        field = np.zeros((H, W), np.float32); field[yy, xx] = np.clip(np.sin(2 * np.pi * (ph * 2 + poff)), 0, 1) ** 3
        field = np.asarray(Image.fromarray((field * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(2)), np.float32) / 255.0
        f = np.asarray(frame, np.float32) + field[..., None] * 130 + grain[n]
        Image.fromarray(np.clip(f, 0, 255).astype(np.uint8)).save(os.path.join(tmp, f"f{n:04d}.png"))

    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-framerate", str(out_fps),
                    "-i", os.path.join(tmp, "f%04d.png"), "-c:v", "libx264", "-crf", "18",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_path], check=True)
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)
    return (W, H), nframes, "fall"


# ---- public entrypoint ---------------------------------------------------
def animate(image_bytes, instruction="", motion="", mask_bytes=None,
            intensity=0.5, speed=1, duration=6.0, fps=25, long_edge=800):
    """Render a looping animation mp4 from a finished artwork. Returns (mp4_bytes, meta).
    `instruction` (free text) chooses the effect unless `motion` is given explicitly."""
    motion = parse_instruction(instruction) if instruction.strip() else (motion or "holo")
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    if max(img.size) > long_edge:
        r = long_edge / max(img.size)
        img = img.resize((int(img.width * r) // 2 * 2, int(img.height * r) // 2 * 2), Image.LANCZOS)

    out_path = os.path.join(tempfile.mkdtemp(prefix="anim_"), "out.mp4")
    if motion == "fall":
        dims, nframes, used = _render_fall(img, out_path, intensity, speed, duration)
    else:
        dims, nframes, used = _render_inplace(img, out_path, motion, mask_bytes, intensity, speed, duration, fps)

    with open(out_path, "rb") as f:
        data = f.read()
    os.remove(out_path); os.rmdir(os.path.dirname(out_path))
    return data, {"dimensions": {"width": dims[0], "height": dims[1]}, "frames": nframes, "effect": used}


def _render_inplace(img, out_path, motion, mask_bytes, intensity, speed, duration, fps):
    base = np.asarray(img, np.float32) / 255.0
    H, W = base.shape[:2]
    lum = base.mean(2)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    diag = (xx / W + yy / H) / 2.0
    cyc = max(1, int(round(speed)))
    nframes = max(2, int(round(duration * fps)))

    m3 = None
    if mask_bytes:
        m = Image.open(io.BytesIO(mask_bytes)).convert("L").resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(6))
        ma = np.asarray(m, np.float32) / 255.0
        if ma.max() > 0.02:
            m3 = ma[..., None]

    tmp = tempfile.mkdtemp(prefix="embers_")
    for n in range(nframes):
        ph = n / nframes
        if motion == "glow":      eff = _glow(base, lum, ph, intensity, cyc)
        elif motion == "flicker": eff = _flicker(base, ph, intensity, cyc)
        elif motion == "sweep":   eff = _sweep(base, diag, ph, intensity, cyc)
        elif motion == "sparkle": eff = _sparkle(base, ph, intensity, cyc, H, W)
        elif motion == "ripple":  eff = _ripple(base, yy, xx, ph, intensity, cyc, H, W)
        elif motion == "scan":    eff = _scan(base, yy, H, ph, intensity, cyc)
        elif motion == "prism":   eff = _holo(base, lum, diag, ph, intensity, cyc, freq=3.5, sat=1.0, glint=0.0)
        else:                     eff = _holo(base, lum, diag, ph, intensity, cyc)
        out = base + (eff - base) * m3 if m3 is not None else eff
        Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(os.path.join(tmp, f"f{n:04d}.png"))

    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-framerate", str(fps),
                    "-i", os.path.join(tmp, "f%04d.png"), "-c:v", "libx264", "-crf", "18",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_path], check=True)
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)
    return (W, H), nframes, motion
