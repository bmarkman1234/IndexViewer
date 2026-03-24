const fileInput = document.getElementById("bandFiles");
const statusLine = document.getElementById("statusLine");
const bandList = document.getElementById("bandList");
const indexLabel = document.getElementById("indexLabel");
const formulaType = document.getElementById("formulaType");
const bandA = document.getElementById("bandA");
const bandB = document.getElementById("bandB");
const computeBtn = document.getElementById("computeBtn");

const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
const indexCanvas = document.getElementById("indexCanvas");
const indexCtx = indexCanvas.getContext("2d");

const bandStore = new Map();
let workingWidth = 0;
let workingHeight = 0;

const bandAliases = {
  B2: "BLUE",
  B3: "GREEN",
  B4: "RED",
  B5: "NIR",
  B6: "SWIR1",
  BLUE: "BLUE",
  GREEN: "GREEN",
  RED: "RED",
  NIR: "NIR",
  SWIR1: "SWIR1"
};

function setStatus(text) {
  statusLine.textContent = text;
}

function detectBandName(filename) {
  const upper = filename.toUpperCase();
  const match = upper.match(/(?:^|[_\-.])B([2-6])(?:[_\-.]|$)/);
  if (match) return `B${match[1]}`;
  if (upper.includes("NIR")) return "NIR";
  if (upper.includes("SWIR1")) return "SWIR1";
  if (upper.includes("RED")) return "RED";
  if (upper.includes("GREEN")) return "GREEN";
  if (upper.includes("BLUE")) return "BLUE";
  return null;
}

function normalizeReflectance(values) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return values;

  const scaled = new Float32Array(values.length);
  const needsScale = max > 2.5;
  for (let i = 0; i < values.length; i += 1) {
    const v = Number.isFinite(values[i]) ? values[i] : 0;
    const out = needsScale ? v / 10000 : v;
    scaled[i] = Math.max(0, Math.min(1.5, out));
  }
  return scaled;
}

function stretchToByte(values) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const out = new Uint8ClampedArray(values.length);
  if (max <= min) return out;
  const scale = 255 / (max - min);
  for (let i = 0; i < values.length; i += 1) {
    out[i] = Math.max(0, Math.min(255, Math.round((values[i] - min) * scale)));
  }
  return out;
}

function resampleNearest(values, srcW, srcH, dstW, dstH) {
  if (srcW === dstW && srcH === dstH) return values;
  const out = new Float32Array(dstW * dstH);
  for (let y = 0; y < dstH; y += 1) {
    const srcY = Math.min(srcH - 1, Math.floor((y / dstH) * srcH));
    for (let x = 0; x < dstW; x += 1) {
      const srcX = Math.min(srcW - 1, Math.floor((x / dstW) * srcW));
      out[y * dstW + x] = values[srcY * srcW + srcX];
    }
  }
  return out;
}

async function readGeoTiffBand(file) {
  const buffer = await file.arrayBuffer();
  const tiff = await GeoTIFF.fromArrayBuffer(buffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters({ interleave: true });
  const raw = normalizeReflectance(Float32Array.from(rasters));
  return { values: raw, width: image.getWidth(), height: image.getHeight() };
}

async function readImageBand(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = objectUrl;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
    const band = new Float32Array(img.width * img.height);
    for (let i = 0, p = 0; i < band.length; i += 1, p += 4) {
      band[i] = (pixels[p] + pixels[p + 1] + pixels[p + 2]) / (3 * 255);
    }
    return { values: band, width: img.width, height: img.height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function renderBandList() {
  bandList.innerHTML = "";
  [...bandStore.entries()].forEach(([band, payload]) => {
    const li = document.createElement("li");
    li.textContent = `${band}: ${payload.width} x ${payload.height}`;
    bandList.appendChild(li);
  });
}

function renderBandSelectors() {
  const options = [...bandStore.keys()];
  bandA.innerHTML = "";
  bandB.innerHTML = "";
  options.forEach((name) => {
    const o1 = document.createElement("option");
    o1.value = name;
    o1.textContent = name;
    bandA.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = name;
    o2.textContent = name;
    bandB.appendChild(o2);
  });

  if (options.includes("NIR")) bandA.value = "NIR";
  if (options.includes("RED")) bandB.value = "RED";
  if (bandB.value === bandA.value && options.length > 1) bandB.value = options[1];
}

function renderPreview() {
  const red = bandStore.get("RED");
  const green = bandStore.get("GREEN");
  const blue = bandStore.get("BLUE");
  const fallback = bandStore.get("NIR") || red || green || blue || bandStore.get("SWIR1");
  if (!fallback) return;

  const w = workingWidth;
  const h = workingHeight;
  previewCanvas.width = w;
  previewCanvas.height = h;
  const img = previewCtx.createImageData(w, h);

  const redVals = red ? red.values : fallback.values;
  const greenVals = green ? green.values : fallback.values;
  const blueVals = blue ? blue.values : fallback.values;
  const r8 = stretchToByte(redVals);
  const g8 = stretchToByte(greenVals);
  const b8 = stretchToByte(blueVals);

  for (let i = 0, p = 0; i < w * h; i += 1, p += 4) {
    img.data[p] = r8[i];
    img.data[p + 1] = g8[i];
    img.data[p + 2] = b8[i];
    img.data[p + 3] = 255;
  }
  previewCtx.putImageData(img, 0, 0);
}

function colorizeIndex(value) {
  const v = Math.max(-1, Math.min(1, value));
  if (v < -0.2) return [41, 98, 255];
  if (v < 0.1) return [120, 181, 255];
  if (v < 0.3) return [245, 222, 136];
  if (v < 0.55) return [155, 205, 75];
  return [33, 138, 68];
}

function requireBands(required) {
  const missing = required.filter((b) => !bandStore.has(b));
  return missing;
}

function computeIndex() {
  const label = indexLabel.value.trim() || "Custom Index";
  const formula = formulaType.value;
  const req = [bandA.value, bandB.value];
  const missing = requireBands(req.filter(Boolean));
  if (missing.length > 0) {
    setStatus(`Cannot compute. Missing: ${missing.join(", ")}`);
    return;
  }
  if (!req[0] || !req[1]) {
    setStatus("Choose both Band A and Band B.");
    return;
  }

  const a = bandStore.get(req[0]).values;
  const b = bandStore.get(req[1]).values;
  const out = new Float32Array(a.length);

  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    const den = x + y;
    let value = 0;

    if (formula === "ratio") value = y === 0 ? 0 : x / y;
    else if (formula === "diff") value = x - y;
    else value = den === 0 ? 0 : (x - y) / den;
    out[i] = Number.isFinite(value) ? value : 0;
  }

  indexCanvas.width = workingWidth;
  indexCanvas.height = workingHeight;
  const img = indexCtx.createImageData(workingWidth, workingHeight);
  for (let i = 0, p = 0; i < out.length; i += 1, p += 4) {
    const [r, g, bColor] = colorizeIndex(out[i]);
    img.data[p] = r;
    img.data[p + 1] = g;
    img.data[p + 2] = bColor;
    img.data[p + 3] = 255;
  }
  indexCtx.putImageData(img, 0, 0);
  setStatus(
    `${label} computed on ${workingWidth} x ${workingHeight} using ${formula.toUpperCase()} with A=${req[0]}, B=${req[1]}.`
  );
}

async function ingestFile(file) {
  const detected = detectBandName(file.name);
  if (!detected) return;
  const logicalBand = bandAliases[detected];
  if (!logicalBand) return;

  const lower = file.name.toLowerCase();
  const isTiff = lower.endsWith(".tif") || lower.endsWith(".tiff");
  const payload = isTiff ? await readGeoTiffBand(file) : await readImageBand(file);
  bandStore.set(logicalBand, payload);
}

async function handleFiles(files) {
  if (!files || files.length === 0) return;
  setStatus("Reading uploaded files...");

  bandStore.clear();
  for (let i = 0; i < files.length; i += 1) {
    try {
      await ingestFile(files[i]);
    } catch (err) {
      console.error(err);
      setStatus(`Error reading ${files[i].name}.`);
    }
  }

  if (bandStore.size === 0) {
    setStatus("No supported band names found. Include names like B4, B5, B6.");
    renderBandList();
    return;
  }

  const dims = [...bandStore.values()].map((b) => ({ w: b.width, h: b.height }));
  workingWidth = Math.min(...dims.map((d) => d.w));
  workingHeight = Math.min(...dims.map((d) => d.h));

  bandStore.forEach((payload, key) => {
    const resampled = resampleNearest(payload.values, payload.width, payload.height, workingWidth, workingHeight);
    bandStore.set(key, { values: resampled, width: workingWidth, height: workingHeight });
  });

  renderBandList();
  renderBandSelectors();
  renderPreview();
  indexCtx.clearRect(0, 0, indexCanvas.width, indexCanvas.height);
  setStatus(`Loaded ${bandStore.size} bands. Ready to compute index.`);
}

fileInput.addEventListener("change", (e) => {
  const files = e.target.files;
  handleFiles(files);
});

computeBtn.addEventListener("click", computeIndex);
