import re
from typing import Dict

import numpy as np
import streamlit as st
import tifffile
from PIL import Image


st.set_page_config(page_title="Satellite Index Viewer", layout="wide")


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


def read_band(uploaded_file) -> np.ndarray:
  name = uploaded_file.name.lower()
  uploaded_file.seek(0)
  if name.endswith(".tif") or name.endswith(".tiff"):
    raw = tifffile.imread(uploaded_file)
    arr = np.asarray(raw).squeeze()
    if arr.ndim == 3:
      arr = arr[0] if arr.shape[0] <= arr.shape[-1] else arr[..., 0]
  else:
    img = Image.open(uploaded_file).convert("L")
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


def build_preview_rgb(bands: Dict[str, np.ndarray]) -> np.ndarray:
  fallback = bands.get("NIR")
  if fallback is None:
    fallback = bands.get("RED")
  if fallback is None:
    fallback = bands.get("GREEN")
  if fallback is None:
    fallback = bands.get("BLUE")
  if fallback is None:
    fallback = bands.get("SWIR1")
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


def load_uploaded_bands(files) -> Dict[str, np.ndarray]:
  bands: Dict[str, np.ndarray] = {}
  for f in files:
    detected = detect_band_name(f.name or "")
    if not detected:
      continue
    logical = BAND_ALIASES.get(detected)
    if not logical:
      continue
    try:
      arr = read_band(f)
    except Exception:
      continue
    if arr.ndim != 2 or min(arr.shape) < 2:
      continue
    bands[logical] = arr

  if not bands:
    return {}

  min_h = min(v.shape[0] for v in bands.values())
  min_w = min(v.shape[1] for v in bands.values())
  return {k: resample_nearest(v, min_h, min_w) for k, v in bands.items()}


st.title("Satellite Image Index Viewer")
st.caption("Upload Landsat-style bands and calculate indices in Python with Streamlit.")

uploaded_files = st.file_uploader(
  "Upload bands (.tif/.tiff/.png/.jpg) with names like B4, B5, B6",
  type=["tif", "tiff", "png", "jpg", "jpeg"],
  accept_multiple_files=True,
)

if not uploaded_files:
  st.info("Upload one or more files to begin.")
  st.stop()

bands = load_uploaded_bands(uploaded_files)
if not bands:
  st.error("No supported bands found. Ensure filenames include B2/B3/B4/B5/B6 or RED/GREEN/BLUE/NIR/SWIR1.")
  st.stop()

band_names = sorted(bands.keys())
h, w = next(iter(bands.values())).shape
st.success(f"Loaded {len(bands)} bands at {w}x{h}.")
st.write("Bands:", ", ".join(band_names))

controls_col, image_col = st.columns([1, 2])

with controls_col:
  st.subheader("Manual Index Calculator")
  index_label = st.text_input("Index label", value="Custom ND")
  formula = st.selectbox("Formula", ["nd", "ratio", "diff"], format_func=lambda x: {"nd": "(A - B) / (A + B)", "ratio": "A / B", "diff": "A - B"}[x])
  default_a = band_names.index("NIR") if "NIR" in band_names else 0
  default_b = band_names.index("RED") if "RED" in band_names else (1 if len(band_names) > 1 else 0)
  band_a = st.selectbox("Band A", band_names, index=default_a)
  band_b = st.selectbox("Band B", band_names, index=default_b)
  run = st.button("Calculate Index", type="primary")

with image_col:
  st.subheader("Preview Composite")
  preview = build_preview_rgb(bands)
  st.image(preview, use_container_width=True, clamp=True)

if run:
  a = bands[band_a]
  b = bands[band_b]
  with np.errstate(divide="ignore", invalid="ignore"):
    if formula == "ratio":
      out = np.where(b == 0, 0.0, a / b)
    elif formula == "diff":
      out = a - b
    else:
      den = a + b
      out = np.where(den == 0, 0.0, (a - b) / den)
  out = np.nan_to_num(out, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)
  index_rgb = colorize_index(out)
  st.subheader("Index Map")
  st.image(index_rgb, caption=f"{index_label} using {formula.upper()} with A={band_a}, B={band_b}", use_container_width=True)
