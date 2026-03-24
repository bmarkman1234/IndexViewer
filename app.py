import base64
import io
import re
import uuid
from dataclasses import dataclass
from typing import Dict, Tuple

import numpy as np
import tifffile
from PIL import Image
from flask import Flask, jsonify, request, send_from_directory


app = Flask(__name__, static_folder=".", static_url_path="")


@dataclass
class SessionData:
  bands: Dict[str, np.ndarray]
  width: int
  height: int


SESSIONS: Dict[str, SessionData] = {}

BAND_ALIASES = {
  "B2": "BLUE",
  "B3": "GREEN",
  "B4": "RED",
  "B5": "NIR",
  "B6": "SWIR1",
  "BLUE": "BLUE",
  "GREEN": "GREEN",
  "RED": "RED",
  "NIR": "NIR",
  "SWIR1": "SWIR1",
}


def detect_band_name(filename: str):
  upper = filename.upper()
  match = re.search(r"(?:^|[_\-.])B([2-6])(?:[_\-.]|$)", upper)
  if match:
    return f"B{match.group(1)}"
  for name in ("NIR", "SWIR1", "RED", "GREEN", "BLUE"):
    if name in upper:
      return name
  return None


def normalize_reflectance(values: np.ndarray) -> np.ndarray:
  values = values.astype(np.float32, copy=False)
  finite = values[np.isfinite(values)]
  if finite.size == 0:
    return np.zeros_like(values, dtype=np.float32)
  vmax = float(np.max(finite))
  if vmax > 2.5:
    values = values / 10000.0
  return np.clip(values, 0, 1.5).astype(np.float32)


def read_band(file_storage) -> np.ndarray:
  name = file_storage.filename.lower()
  file_storage.stream.seek(0)
  if name.endswith(".tif") or name.endswith(".tiff"):
    raw = tifffile.imread(file_storage.stream)
    arr = np.asarray(raw).squeeze()
    if arr.ndim == 3:
      arr = arr[0] if arr.shape[0] <= arr.shape[-1] else arr[..., 0]
  else:
    img = Image.open(file_storage.stream).convert("L")
    arr = np.asarray(img)
  return normalize_reflectance(np.asarray(arr))


def resample_nearest(arr: np.ndarray, dst_h: int, dst_w: int) -> np.ndarray:
  src_h, src_w = arr.shape
  if src_h == dst_h and src_w == dst_w:
    return arr
  y_idx = np.minimum(src_h - 1, (np.arange(dst_h) * src_h / dst_h).astype(np.int32))
  x_idx = np.minimum(src_w - 1, (np.arange(dst_w) * src_w / dst_w).astype(np.int32))
  return arr[y_idx[:, None], x_idx[None, :]]


def stretch_to_byte(arr: np.ndarray) -> np.ndarray:
  finite = arr[np.isfinite(arr)]
  if finite.size == 0:
    return np.zeros(arr.shape, dtype=np.uint8)
  amin = float(np.min(finite))
  amax = float(np.max(finite))
  if amax <= amin:
    return np.zeros(arr.shape, dtype=np.uint8)
  out = ((arr - amin) * (255.0 / (amax - amin))).clip(0, 255)
  return out.astype(np.uint8)


def to_png_base64(rgb: np.ndarray) -> str:
  image = Image.fromarray(rgb, mode="RGB")
  buf = io.BytesIO()
  image.save(buf, format="PNG")
  return base64.b64encode(buf.getvalue()).decode("ascii")


def build_preview_rgb(bands: Dict[str, np.ndarray]) -> np.ndarray:
  fallback = bands.get("NIR") or bands.get("RED") or bands.get("GREEN") or bands.get("BLUE") or bands.get("SWIR1")
  if fallback is None:
    raise ValueError("No previewable band found.")
  r = stretch_to_byte(bands.get("RED", fallback))
  g = stretch_to_byte(bands.get("GREEN", fallback))
  b = stretch_to_byte(bands.get("BLUE", fallback))
  return np.dstack([r, g, b])


def colorize_index(index_arr: np.ndarray) -> np.ndarray:
  v = np.clip(index_arr, -1.0, 1.0)
  rgb = np.zeros((v.shape[0], v.shape[1], 3), dtype=np.uint8)

  mask1 = v < -0.2
  mask2 = (v >= -0.2) & (v < 0.1)
  mask3 = (v >= 0.1) & (v < 0.3)
  mask4 = (v >= 0.3) & (v < 0.55)
  mask5 = v >= 0.55

  rgb[mask1] = [41, 98, 255]
  rgb[mask2] = [120, 181, 255]
  rgb[mask3] = [245, 222, 136]
  rgb[mask4] = [155, 205, 75]
  rgb[mask5] = [33, 138, 68]
  return rgb


def downscale_if_needed(bands: Dict[str, np.ndarray], max_dim: int = 1024) -> Tuple[Dict[str, np.ndarray], int, int]:
  h, w = next(iter(bands.values())).shape
  if max(h, w) <= max_dim:
    return bands, w, h
  if w >= h:
    dst_w = max_dim
    dst_h = max(1, int(round(h * (max_dim / w))))
  else:
    dst_h = max_dim
    dst_w = max(1, int(round(w * (max_dim / h))))
  out = {k: resample_nearest(v, dst_h, dst_w) for k, v in bands.items()}
  return out, dst_w, dst_h


@app.get("/")
def root():
  return send_from_directory(".", "index.html")


@app.post("/api/upload")
def upload_bands():
  files = request.files.getlist("files")
  if not files:
    return jsonify({"error": "No files uploaded."}), 400

  bands: Dict[str, np.ndarray] = {}
  for fs in files:
    detected = detect_band_name(fs.filename or "")
    if not detected:
      continue
    logical = BAND_ALIASES.get(detected)
    if not logical:
      continue
    try:
      arr = read_band(fs)
    except Exception:
      continue
    if arr.ndim != 2 or min(arr.shape) < 2:
      continue
    bands[logical] = arr

  if not bands:
    return jsonify({"error": "No supported bands found. Use names like B4, B5, B6."}), 400

  min_h = min(v.shape[0] for v in bands.values())
  min_w = min(v.shape[1] for v in bands.values())
  bands = {k: resample_nearest(v, min_h, min_w) for k, v in bands.items()}
  bands, width, height = downscale_if_needed(bands)

  session_id = str(uuid.uuid4())
  SESSIONS[session_id] = SessionData(bands=bands, width=width, height=height)

  preview = build_preview_rgb(bands)
  return jsonify(
    {
      "session_id": session_id,
      "bands": sorted(bands.keys()),
      "width": width,
      "height": height,
      "preview_png_base64": to_png_base64(preview),
      "status": f"Loaded {len(bands)} bands at {width}x{height}.",
    }
  )


@app.post("/api/compute")
def compute_index():
  payload = request.get_json(silent=True) or {}
  session_id = payload.get("session_id")
  formula = payload.get("formula")
  band_a = payload.get("band_a")
  band_b = payload.get("band_b")
  label = payload.get("label", "Custom Index")

  if not session_id or session_id not in SESSIONS:
    return jsonify({"error": "Session not found. Upload bands first."}), 400
  if formula not in {"nd", "ratio", "diff"}:
    return jsonify({"error": "Invalid formula."}), 400

  sess = SESSIONS[session_id]
  if band_a not in sess.bands or band_b not in sess.bands:
    return jsonify({"error": "Requested band not available in current session."}), 400

  a = sess.bands[band_a]
  b = sess.bands[band_b]

  with np.errstate(divide="ignore", invalid="ignore"):
    if formula == "ratio":
      out = np.where(b == 0, 0.0, a / b)
    elif formula == "diff":
      out = a - b
    else:
      den = a + b
      out = np.where(den == 0, 0.0, (a - b) / den)
  out = np.nan_to_num(out, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)

  rgb = colorize_index(out)
  return jsonify(
    {
      "index_png_base64": to_png_base64(rgb),
      "status": f"{label} computed using {formula.upper()} with A={band_a}, B={band_b}.",
      "width": sess.width,
      "height": sess.height,
    }
  )


if __name__ == "__main__":
  app.run(host="127.0.0.1", port=8000, debug=True)
