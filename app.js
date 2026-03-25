const fileInput = document.getElementById("bandFiles");
const statusLine = document.getElementById("statusLine");
const bandList = document.getElementById("bandList");
const indexLabel = document.getElementById("indexLabel");
const formulaInput = document.getElementById("formulaInput");
const formulaHint = document.getElementById("formulaHint");
const computeBtn = document.getElementById("computeBtn");

const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
const indexCanvas = document.getElementById("indexCanvas");
const indexCtx = indexCanvas.getContext("2d");

const bandStore = new Map();
let workingWidth = 0;
let workingHeight = 0;

const rasterFns = {
  abs: Math.abs,
  sqrt: Math.sqrt,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
  log: Math.log,
  exp: Math.exp,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan
};

const rasterConsts = {
  PI: Math.PI,
  E: Math.E
};

function setStatus(text) {
  statusLine.textContent = text;
}

function uniqueBandName(baseName) {
  if (!bandStore.has(baseName)) return baseName;
  let suffix = 2;
  while (bandStore.has(`${baseName} [${suffix}]`)) suffix += 1;
  return `${baseName} [${suffix}]`;
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

async function readGeoTiffBands(file) {
  const buffer = await file.arrayBuffer();
  const tiff = await GeoTIFF.fromArrayBuffer(buffer);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const samples = image.getSamplesPerPixel();
  const sampleIndexes = Array.from({ length: samples }, (_, i) => i);
  const rasters = await image.readRasters({ samples: sampleIndexes });

  if (samples === 1) {
    return [
      {
        name: file.name,
        payload: {
          values: normalizeReflectance(Float32Array.from(rasters[0])),
          width,
          height
        }
      }
    ];
  }

  return rasters.map((sample, idx) => {
    return {
      name: `${file.name} [Band ${idx + 1}]`,
      payload: {
        values: normalizeReflectance(Float32Array.from(sample)),
        width,
        height
      }
    };
  });
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

function renderFormulaHint() {
  const names = [...bandStore.keys()];
  if (names.length === 0) {
    formulaHint.textContent = "Upload bands to enable raster algebra.";
    return;
  }
  const refs = names.map((name) => `[${name}]`).join(", ");
  formulaHint.textContent = `Band references: ${refs}. Helpers: ${Object.keys(rasterFns).join(", ")}. Constants: ${Object.keys(rasterConsts).join(", ")}.`;
}

function renderPreview() {
  const red = bandStore.get("RED");
  const green = bandStore.get("GREEN");
  const blue = bandStore.get("BLUE");
  const firstBand = bandStore.values().next().value;
  const fallback = red || green || blue || firstBand;
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

function colorizeNormalized(t) {
  const x = Math.max(0, Math.min(1, t));
  if (x < 0.25) return [40, 88, 180];
  if (x < 0.5) return [117, 176, 230];
  if (x < 0.75) return [239, 214, 132];
  return [38, 128, 66];
}

function compileRasterFormula(rawFormula) {
  const normalized = rawFormula.replace(/\^/g, "**");
  if (!/^[A-Za-z0-9_+\-*/().,\s^[\]]+$/.test(rawFormula)) {
    throw new Error("Formula contains unsupported characters.");
  }

  const refs = new Map();
  let refIndex = 0;
  const transformed = normalized.replace(/\[([^\]]+)\]/g, (_, label) => {
    const bandName = label.trim();
    if (!bandStore.has(bandName)) {
      throw new Error(`Unknown band "${bandName}". Use names shown in the band list.`);
    }
    if (!refs.has(bandName)) {
      refs.set(bandName, `B${refIndex}`);
      refIndex += 1;
    }
    return refs.get(bandName);
  });

  if (transformed.includes("[") || transformed.includes("]")) {
    throw new Error("Malformed band reference. Use [exact band name].");
  }

  const bandRefs = [...refs.entries()].map(([name, symbol]) => ({ name, symbol }));
  if (bandRefs.length === 0) {
    throw new Error("Reference at least one band using [band name].");
  }

  const bandSymbols = bandRefs.map((entry) => entry.symbol);
  const helperNames = Object.keys(rasterFns);
  const constNames = Object.keys(rasterConsts);
  const allowed = new Set([...bandSymbols, ...helperNames, ...constNames]);
  const identifiers = transformed.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];

  for (const id of identifiers) {
    if (!allowed.has(id)) {
      throw new Error(`Unknown token "${id}". Use [band name] references and supported helpers.`);
    }
  }

  const evaluator = new Function(
    ...bandSymbols,
    ...helperNames,
    ...constNames,
    `"use strict"; return (${transformed});`
  );

  return {
    bandRefs,
    helperNames,
    constNames,
    evaluator
  };
}

function computeIndex() {
  const label = indexLabel.value.trim() || "Custom Index";
  const formula = formulaInput.value.trim();
  if (!formula) {
    setStatus("Enter a raster algebra formula.");
    return;
  }

  if (bandStore.size === 0) {
    setStatus("Upload at least one band first.");
    return;
  }

  let compiled;
  try {
    compiled = compileRasterFormula(formula);
  } catch (err) {
    setStatus(err.message);
    return;
  }

  const { bandRefs, helperNames, constNames, evaluator } = compiled;
  const bandArrays = bandRefs.map((entry) => bandStore.get(entry.name).values);
  const helperFns = helperNames.map((name) => rasterFns[name]);
  const constValues = constNames.map((name) => rasterConsts[name]);
  const out = new Float32Array(workingWidth * workingHeight);
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < out.length; i += 1) {
    const bandValues = bandArrays.map((arr) => arr[i]);
    let value = 0;
    try {
      value = evaluator(...bandValues, ...helperFns, ...constValues);
    } catch (err) {
      setStatus(`Formula evaluation failed near pixel ${i}: ${err.message}`);
      return;
    }
    const safeValue = Number.isFinite(value) ? value : 0;
    out[i] = safeValue;
    if (safeValue < min) min = safeValue;
    if (safeValue > max) max = safeValue;
  }

  indexCanvas.width = workingWidth;
  indexCanvas.height = workingHeight;
  const img = indexCtx.createImageData(workingWidth, workingHeight);
  const span = max - min || 1;
  for (let i = 0, p = 0; i < out.length; i += 1, p += 4) {
    const t = (out[i] - min) / span;
    const [r, g, bColor] = colorizeNormalized(t);
    img.data[p] = r;
    img.data[p + 1] = g;
    img.data[p + 2] = bColor;
    img.data[p + 3] = 255;
  }
  indexCtx.putImageData(img, 0, 0);
  setStatus(
    `${label} computed on ${workingWidth} x ${workingHeight} using "${formula}". Range: ${min.toFixed(4)} to ${max.toFixed(4)}.`
  );
}

async function ingestFile(file) {
  const lower = file.name.toLowerCase();
  const isTiff = lower.endsWith(".tif") || lower.endsWith(".tiff");
  if (isTiff) {
    const entries = await readGeoTiffBands(file);
    entries.forEach((entry) => {
      bandStore.set(uniqueBandName(entry.name), entry.payload);
    });
    return;
  }

  const payload = await readImageBand(file);
  bandStore.set(uniqueBandName(file.name), payload);
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
    setStatus("No readable raster bands were found in the selected files.");
    renderBandList();
    renderFormulaHint();
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
  renderFormulaHint();
  renderPreview();
  indexCtx.clearRect(0, 0, indexCanvas.width, indexCanvas.height);
  setStatus(`Loaded ${bandStore.size} bands (each TIFF sample is handled as a separate band). Ready for raster algebra.`);
}

fileInput.addEventListener("change", (e) => {
  const files = e.target.files;
  handleFiles(files);
});

computeBtn.addEventListener("click", computeIndex);
