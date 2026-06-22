"""
Embers — GENERATIVE studio engine. Thin orchestration over frontier fal models:
type any instruction → image edit (nano-banana-pro) or video (Kling i2v). No per-effect code —
the model does whatever you describe. Leverage best-in-class media-gen behind SoundCave's taste.
"""
import os, io, base64, time
import requests
from PIL import Image

QUEUE = "https://queue.fal.run"
NANO = "fal-ai/nano-banana-pro/edit"          # instructed image editing (text swaps, object changes)
KLING = "fal-ai/kling-video/v2.6/pro/image-to-video"   # instructed motion (melt, drift, anything)

_ASPECTS = {"1:1": 1.0, "4:5": 0.8, "5:4": 1.25, "3:4": 0.75, "4:3": 1.333,
            "9:16": 0.5625, "16:9": 1.777, "2:3": 0.667, "3:2": 1.5}


def _key():
    k = os.getenv("FAL_KEY")
    if k:
        return k
    from dotenv import load_dotenv
    here = os.path.dirname(os.path.abspath(__file__))
    for up in (4, 3, 5, 2):
        p = os.path.join(here, *([".."] * up), ".env")
        if os.path.exists(p):
            load_dotenv(p); break
    return os.getenv("FAL_KEY")


def _uri(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    b = io.BytesIO(); img.save(b, "PNG")
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode(), img.size


def _aspect(w, h):
    r = w / h
    return min(_ASPECTS, key=lambda k: abs(_ASPECTS[k] - r))


def _submit_poll(model, payload, timeout=600, log=print):
    h = {"Authorization": f"Key {_key()}", "Content-Type": "application/json"}
    d = requests.post(f"{QUEUE}/{model}", headers=h, json=payload, timeout=30).json()
    rid = d.get("request_id")
    if not rid:
        raise RuntimeError(f"{model}: bad submit {str(d)[:200]}")
    su = d.get("status_url") or f"{QUEUE}/{model}/requests/{rid}/status"
    ru = d.get("response_url") or f"{QUEUE}/{model}/requests/{rid}"
    t0 = time.time()
    while time.time() - t0 < timeout:
        time.sleep(4)
        st = requests.get(su, headers=h, timeout=15).json().get("status")
        log(f"   [{model.split('/')[1]}] {st} t+{int(time.time()-t0)}s")
        if st == "COMPLETED":
            return requests.get(ru, headers=h, timeout=90).json()
        if st in ("FAILED", "ERROR"):
            raise RuntimeError(f"{model}: {st}")
    raise RuntimeError(f"{model} timed out")


def edit_image(image_bytes, prompt, log=print):
    """Instructed image edit (text swaps, object changes, restyles). Returns PNG bytes."""
    uri, (w, h) = _uri(image_bytes)
    res = _submit_poll(NANO, {"prompt": prompt, "image_urls": [uri],
                              "aspect_ratio": _aspect(w, h), "resolution": "2K",
                              "output_format": "png", "num_images": 1}, log=log)
    url = (res.get("images") or [res.get("image")])[0]["url"]
    return requests.get(url, timeout=120).content


def animate_video(image_bytes, prompt, duration="5", log=print):
    """Instructed motion from a still (melt, drift, anything). Returns mp4 bytes."""
    uri, _ = _uri(image_bytes)
    res = _submit_poll(KLING, {"start_image_url": uri, "prompt": prompt,
                               "duration": str(duration), "generate_audio": False}, log=log)
    return requests.get(res["video"]["url"], timeout=180).content
