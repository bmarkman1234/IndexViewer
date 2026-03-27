const fileInput = document.getElementById("bandFiles");
const statusStep1 = document.getElementById("statusStep1");
const statusStep2 = document.getElementById("statusStep2");
const statusStep3 = document.getElementById("statusStep3");
const statusStep4 = document.getElementById("statusStep4");
const bandAliasList = document.getElementById("bandAliasList");
const indexLabel = document.getElementById("indexLabel");
const formulaInput = document.getElementById("formulaInput");
const formulaHint = document.getElementById("formulaHint");
const computeBtn = document.getElementById("computeBtn");
const reviewBandsOkBtn = document.getElementById("reviewBandsOkBtn");
const workflowProgressText = document.getElementById("workflowProgressText");
const workflowProgressFill = document.getElementById("workflowProgressFill");
const newIndexBtn = document.getElementById("newIndexBtn");
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const step4 = document.getElementById("step4");
const step1State = document.getElementById("step1State");
const step2State = document.getElementById("step2State");
const step3State = document.getElementById("step3State");
const step4State = document.getElementById("step4State");
const snapshotSelect = document.getElementById("snapshotSelect");
const showSnapshotBtn = document.getElementById("showSnapshotBtn");
const deleteSnapshotBtn = document.getElementById("deleteSnapshotBtn");
const compareBlendInput = document.getElementById("compareBlend");
const compareBlendValue = document.getElementById("compareBlendValue");
const compareBlendControl = document.getElementById("compareBlendControl");
const vectorFileInput = document.getElementById("vectorFileInput");
const clearVectorBtn = document.getElementById("clearVectorBtn");

const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
const indexCanvas = document.getElementById("indexCanvas");
const indexCtx = indexCanvas.getContext("2d");
const exportProbeCsvBtn = document.getElementById("exportProbeCsvBtn");
const mapContainer = document.getElementById("mapContainer");
const overlayOpacityInput = document.getElementById("overlayOpacity");
const pixelCoords = document.getElementById("pixelCoords");
const pixelValuesList = document.getElementById("pixelValuesList");
const pixelTrendCanvas = document.getElementById("pixelTrendCanvas");
const pixelTrendCtx = pixelTrendCanvas ? pixelTrendCanvas.getContext("2d") : null;

const bandStore = new Map();
const aliasStore = new Map();
const aliasConfirmedStore = new Set();
let workingWidth = 0;
let workingHeight = 0;
let workingGeoBounds = null;
let map = null;
let mapBaseOverlay = null;
let mapCompareOverlay = null;
let mapVectorOverlay = null;
let mapProbeMarker = null;
let overlayOpacity = 0.7;
let compareBlend = 0.5;
let probeLatLng = null;
let snapshotCounter = 0;
let newIndexCyclePending = false;
let reviewBandsAccepted = false;
const snapshotStore = [];

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

function setStatus(text, step = 1) {
  const stepStatusMap = {
    1: statusStep1,
    2: statusStep2,
    3: statusStep3,
    4: statusStep4
  };
  const target = stepStatusMap[step] || statusStep1;
  if (target) target.textContent = text;
}

function applyStepState(cardEl, stateEl, state, label) {
  if (stateEl) {
    stateEl.textContent = label;
    stateEl.classList.remove("pending", "in-progress", "complete");
    stateEl.classList.add(state);
  }
  if (cardEl) {
    cardEl.classList.remove("pending", "in-progress", "complete");
    cardEl.classList.add(state);
    if (state === "in-progress") cardEl.classList.add("in-progress");
    if (state === "complete") cardEl.classList.add("complete");
  }
}

function updateWorkflowProgress() {
  const hasBands = bandStore.size > 0;
  const aliasesReady =
    hasBands &&
    aliasStore.size === bandStore.size &&
    aliasConfirmedStore.size === bandStore.size &&
    reviewBandsAccepted &&
    [...aliasStore.values()].every((alias) => alias.trim().length > 0);
  const hasSavedSnapshots = snapshotStore.length > 0;
  const hasComputed = hasSavedSnapshots && !newIndexCyclePending;
  const hasSavedForCompare = hasSavedSnapshots && !newIndexCyclePending;

  const completedCount = [hasBands, aliasesReady, hasComputed, hasSavedForCompare].filter(Boolean).length;
  const firstIncomplete = !hasBands ? 1 : !aliasesReady ? 2 : !hasComputed ? 3 : !hasSavedForCompare ? 4 : 0;

  applyStepState(step1, step1State, hasBands ? "complete" : firstIncomplete === 1 ? "in-progress" : "pending", hasBands ? "Complete" : firstIncomplete === 1 ? "In Progress" : "Pending");
  applyStepState(step2, step2State, aliasesReady ? "complete" : firstIncomplete === 2 ? "in-progress" : "pending", aliasesReady ? "Complete" : firstIncomplete === 2 ? "In Progress" : "Pending");
  applyStepState(step3, step3State, hasComputed ? "complete" : firstIncomplete === 3 ? "in-progress" : "pending", hasComputed ? "Complete" : firstIncomplete === 3 ? "In Progress" : "Pending");
  applyStepState(step4, step4State, hasSavedForCompare ? "complete" : firstIncomplete === 4 ? "in-progress" : "pending", hasSavedForCompare ? "Complete" : firstIncomplete === 4 ? "In Progress" : "Pending");

  if (workflowProgressText) workflowProgressText.textContent = `${completedCount} of 4 steps complete`;
  if (workflowProgressFill) workflowProgressFill.style.width = `${(completedCount / 4) * 100}%`;
}

function startNewIndexCycle() {
  bandStore.clear();
  aliasStore.clear();
  aliasConfirmedStore.clear();
  reviewBandsAccepted = false;
  workingWidth = 0;
  workingHeight = 0;
  workingGeoBounds = null;
  if (fileInput) fileInput.value = "";
  renderAliasEditor();
  renderFormulaHint();
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  indexCtx.clearRect(0, 0, indexCanvas.width, indexCanvas.height);
  if (map && mapBaseOverlay) {
    map.removeLayer(mapBaseOverlay);
    mapBaseOverlay = null;
  }
  clearComparisonOverlay();

  newIndexCyclePending = true;
  updateWorkflowProgress();
  if (indexLabel) indexLabel.focus();
  setStatus("Reset to Step 1. Upload bands to start a new index calculation. Saved indices remain in Step 4.", 1);
}

function initMap() {
  if (map || !window.L || !mapContainer) return;
  map = L.map("mapContainer", { zoomControl: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
  map.setView([20, 0], 2);
  map.on("click", (e) => {
    probeLatLng = { lat: e.latlng.lat, lon: e.latlng.lng };
    if (!mapProbeMarker) {
      mapProbeMarker = L.circleMarker(e.latlng, {
        radius: 5,
        color: "#111111",
        weight: 1,
        fillColor: "#ffffff",
        fillOpacity: 1
      }).addTo(map);
    } else {
      mapProbeMarker.setLatLng(e.latlng);
    }
    updatePixelProbePanel();
  });
  setTimeout(() => map.invalidateSize(), 0);
}

function setOverlayOpacityFromInput() {
  if (!overlayOpacityInput) return;
  const pct = Math.max(0, Math.min(100, Number(overlayOpacityInput.value || 70)));
  overlayOpacity = pct / 100;
  applyMapOverlayOpacity();
}

function setCompareBlendFromInput() {
  if (!compareBlendInput) return;
  const pct = Math.max(0, Math.min(100, Number(compareBlendInput.value || 50)));
  compareBlend = pct / 100;
  if (compareBlendValue) compareBlendValue.textContent = `${Math.round(pct)}%`;
  applyMapOverlayOpacity();
}

function updateBlendControlVisibility() {
  if (!compareBlendControl) return;
  compareBlendControl.style.display = snapshotStore.length > 1 ? "block" : "none";
}

function clearComparisonOverlay() {
  if (map && mapCompareOverlay) {
    map.removeLayer(mapCompareOverlay);
  }
  mapCompareOverlay = null;
}

function clearVectorOverlay() {
  if (map && mapVectorOverlay) {
    map.removeLayer(mapVectorOverlay);
  }
  mapVectorOverlay = null;
  updateClearVectorButtonVisibility();
}

function updateClearVectorButtonVisibility() {
  if (!clearVectorBtn) return;
  clearVectorBtn.style.display = mapVectorOverlay ? "block" : "none";
}

function applyMapOverlayOpacity() {
  if (!mapBaseOverlay) return;
  if (mapCompareOverlay) {
    mapBaseOverlay.setOpacity(overlayOpacity * (1 - compareBlend));
    mapCompareOverlay.setOpacity(overlayOpacity * compareBlend);
    return;
  }
  mapBaseOverlay.setOpacity(overlayOpacity);
}

function confirmReviewBands() {
  if (bandStore.size === 0) {
    setStatus("Upload bands first, then confirm aliases in Step 2.", 2);
    return;
  }
  const allAliasesReady =
    aliasStore.size === bandStore.size && [...aliasStore.values()].every((alias) => alias && alias.trim().length > 0);
  if (!allAliasesReady) {
    setStatus("Please set aliases for all bands before confirming.", 2);
    return;
  }
  bandStore.forEach((_, rawName) => aliasConfirmedStore.add(rawName));
  reviewBandsAccepted = true;
  setStatus("Aliases reviewed and confirmed.", 2);
  updateWorkflowProgress();
}

function normalizeGeoJson(input) {
  if (!input) return null;
  if (Array.isArray(input)) {
    const features = input.flatMap((item) => (item && item.features ? item.features : []));
    return { type: "FeatureCollection", features };
  }
  return input;
}

function addVectorOverlay(geojson, sourceName) {
  initMap();
  if (!map) return;
  const normalized = normalizeGeoJson(geojson);
  if (!normalized || !normalized.features || normalized.features.length === 0) {
    setStatus(`No features found in "${sourceName}".`, 4);
    return;
  }

  clearVectorOverlay();
  mapVectorOverlay = L.geoJSON(normalized, {
    style: {
      color: "#111111",
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.05
    },
    pointToLayer: (feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 4,
        color: "#111111",
        weight: 1,
        fillColor: "#ffffff",
        fillOpacity: 0.9
      })
  }).addTo(map);
  updateClearVectorButtonVisibility();

  try {
    const bounds = mapVectorOverlay.getBounds();
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  } catch (err) {
    // No-op: keep current map extent if bounds cannot be computed.
  }
  setStatus(`Loaded vector overlay: ${sourceName}`, 4);
}

function parseKmlTextToGeoJson(kmlText) {
  if (!window.toGeoJSON) {
    throw new Error("KML parser library is not available.");
  }
  const parser = new DOMParser();
  const kmlDoc = parser.parseFromString(kmlText, "text/xml");
  return toGeoJSON.kml(kmlDoc);
}

async function parseKmzToGeoJson(arrayBuffer) {
  if (!window.JSZip) {
    throw new Error("KMZ parser library is not available.");
  }
  const zip = await JSZip.loadAsync(arrayBuffer);
  const kmlEntryName = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith(".kml"));
  if (!kmlEntryName) {
    throw new Error("KMZ file does not contain a .kml document.");
  }
  const kmlText = await zip.files[kmlEntryName].async("text");
  return parseKmlTextToGeoJson(kmlText);
}

async function parseShapefileZipToGeoJson(arrayBuffer) {
  if (typeof shp !== "function") {
    throw new Error("Shapefile parser library is not available.");
  }
  return shp(arrayBuffer);
}

async function handleVectorFileUpload(file) {
  if (!file) return;
  const name = file.name || "uploaded file";
  const lower = name.toLowerCase();

  try {
    if (lower.endsWith(".kml")) {
      const text = await file.text();
      const geojson = parseKmlTextToGeoJson(text);
      addVectorOverlay(geojson, name);
      return;
    }
    if (lower.endsWith(".kmz")) {
      const buffer = await file.arrayBuffer();
      const geojson = await parseKmzToGeoJson(buffer);
      addVectorOverlay(geojson, name);
      return;
    }
    if (lower.endsWith(".zip")) {
      const buffer = await file.arrayBuffer();
      const geojson = await parseShapefileZipToGeoJson(buffer);
      addVectorOverlay(geojson, name);
      return;
    }
    setStatus("Unsupported vector file type. Use .kml, .kmz, or zipped shapefile (.zip).", 4);
  } catch (err) {
    setStatus(`Could not load vector overlay "${name}": ${err.message}`, 4);
  } finally {
    if (vectorFileInput) vectorFileInput.value = "";
  }
}

function isLikelyLatLonBounds(bounds) {
  if (!bounds || bounds.length !== 4) return false;
  const [minX, minY, maxX, maxY] = bounds;
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return false;
  if (minX >= maxX || minY >= maxY) return false;
  return minX >= -180 && maxX <= 180 && minY >= -90 && maxY <= 90;
}

function hasValidBounds(bounds) {
  if (!bounds || bounds.length !== 4) return false;
  const [minX, minY, maxX, maxY] = bounds;
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return false;
  return minX < maxX && minY < maxY;
}

function reprojectBoundsToWgs84(bounds, epsgCode) {
  if (!window.proj4 || !hasValidBounds(bounds) || !Number.isFinite(epsgCode)) return null;
  const src = `EPSG:${epsgCode}`;
  const dst = "EPSG:4326";
  const [minX, minY, maxX, maxY] = bounds;
  const corners = [
    [minX, minY],
    [minX, maxY],
    [maxX, minY],
    [maxX, maxY]
  ];
  try {
    const ll = corners.map(([x, y]) => proj4(src, dst, [x, y]));
    const lons = ll.map((p) => p[0]);
    const lats = ll.map((p) => p[1]);
    const out = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
    return isLikelyLatLonBounds(out) ? out : null;
  } catch (err) {
    return null;
  }
}

function ensureProj4DefinitionForEpsg(epsgCode) {
  if (!window.proj4 || !Number.isFinite(epsgCode)) return;
  const code = `EPSG:${epsgCode}`;
  if (proj4.defs(code)) return;

  if (epsgCode >= 32601 && epsgCode <= 32660) {
    const zone = epsgCode - 32600;
    proj4.defs(code, `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`);
    return;
  }
  if (epsgCode >= 32701 && epsgCode <= 32760) {
    const zone = epsgCode - 32700;
    proj4.defs(code, `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`);
  }
}

function extractWgs84BoundsFromImage(image) {
  let bounds = null;
  try {
    bounds = image.getBoundingBox();
  } catch (err) {
    return null;
  }
  if (!hasValidBounds(bounds)) return null;
  if (isLikelyLatLonBounds(bounds)) return bounds;

  let geoKeys = null;
  try {
    geoKeys = image.getGeoKeys();
  } catch (err) {
    geoKeys = null;
  }
  if (!geoKeys) return null;

  const projected = geoKeys.ProjectedCSTypeGeoKey;
  if (Number.isFinite(projected)) {
    ensureProj4DefinitionForEpsg(projected);
    const projectedOut = reprojectBoundsToWgs84(bounds, projected);
    if (projectedOut) return projectedOut;
  }

  const geographic = geoKeys.GeographicTypeGeoKey;
  if (Number.isFinite(geographic) && geographic !== 4326) {
    ensureProj4DefinitionForEpsg(geographic);
    const geographicOut = reprojectBoundsToWgs84(bounds, geographic);
    if (geographicOut) return geographicOut;
  }

  return null;
}

function updateMapOverlay(imageUrl, geoBounds) {
  initMap();
  if (!map) return;

  if (!geoBounds) {
    if (mapBaseOverlay) {
      map.removeLayer(mapBaseOverlay);
      mapBaseOverlay = null;
    }
    clearComparisonOverlay();
    setStatus("Index computed, but map overlay needs georeferenced bounds (WGS84 or EPSG metadata).", 3);
    return;
  }

  const [minLon, minLat, maxLon, maxLat] = geoBounds;
  const leafletBounds = [
    [minLat, minLon],
    [maxLat, maxLon]
  ];

  if (mapBaseOverlay) {
    mapBaseOverlay.setUrl(imageUrl);
    mapBaseOverlay.setBounds(leafletBounds);
  } else {
    mapBaseOverlay = L.imageOverlay(imageUrl, leafletBounds, { opacity: overlayOpacity, interactive: true }).addTo(map);
  }
  clearComparisonOverlay();
  applyMapOverlayOpacity();
  map.fitBounds(leafletBounds, { padding: [20, 20] });
  setTimeout(() => map.invalidateSize(), 0);
}

function sampleSnapshotAtLatLon(snapshot, lat, lon) {
  if (!snapshot || !snapshot.geoBounds || !snapshot.values) return null;
  const [minLon, minLat, maxLon, maxLat] = snapshot.geoBounds;
  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return null;
  const xRatio = (lon - minLon) / (maxLon - minLon);
  const yRatio = (maxLat - lat) / (maxLat - minLat);
  const x = Math.max(0, Math.min(snapshot.width - 1, Math.round(xRatio * (snapshot.width - 1))));
  const y = Math.max(0, Math.min(snapshot.height - 1, Math.round(yRatio * (snapshot.height - 1))));
  const idx = y * snapshot.width + x;
  const value = snapshot.values[idx];
  if (!Number.isFinite(value)) return null;
  return { value, x, y };
}

function drawPixelTrendChart(points) {
  if (!pixelTrendCtx || !pixelTrendCanvas) return;
  const w = pixelTrendCanvas.width;
  const h = pixelTrendCanvas.height;
  pixelTrendCtx.clearRect(0, 0, w, h);
  pixelTrendCtx.fillStyle = "#ffffff";
  pixelTrendCtx.fillRect(0, 0, w, h);

  if (!points || points.length === 0) {
    pixelTrendCtx.fillStyle = "#444444";
    pixelTrendCtx.font = "12px Segoe UI";
    pixelTrendCtx.fillText("No pixel values available for trend.", 12, 24);
    return;
  }

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const left = 38;
  const right = w - 12;
  const top = 12;
  const bottom = h - 24;
  const spanX = Math.max(1, points.length - 1);
  const spanY = max - min;

  pixelTrendCtx.strokeStyle = "#d0d0d0";
  pixelTrendCtx.lineWidth = 1;
  pixelTrendCtx.beginPath();
  pixelTrendCtx.moveTo(left, top);
  pixelTrendCtx.lineTo(left, bottom);
  pixelTrendCtx.lineTo(right, bottom);
  pixelTrendCtx.stroke();

  pixelTrendCtx.fillStyle = "#333333";
  pixelTrendCtx.font = "11px Segoe UI";
  pixelTrendCtx.fillText(max.toFixed(3), 4, top + 4);
  pixelTrendCtx.fillText(min.toFixed(3), 4, bottom);

  pixelTrendCtx.strokeStyle = "#111111";
  pixelTrendCtx.lineWidth = 2;
  pixelTrendCtx.beginPath();
  points.forEach((p, i) => {
    const x = left + ((right - left) * i) / spanX;
    const y = bottom - ((p.value - min) / spanY) * (bottom - top);
    if (i === 0) pixelTrendCtx.moveTo(x, y);
    else pixelTrendCtx.lineTo(x, y);
  });
  pixelTrendCtx.stroke();

  pixelTrendCtx.fillStyle = "#111111";
  points.forEach((p, i) => {
    const x = left + ((right - left) * i) / spanX;
    const y = bottom - ((p.value - min) / spanY) * (bottom - top);
    pixelTrendCtx.beginPath();
    pixelTrendCtx.arc(x, y, 2.5, 0, Math.PI * 2);
    pixelTrendCtx.fill();
  });
}

function triggerDownload(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportPixelProbeCsv() {
  if (!probeLatLng) {
    setStatus("Click on the map first to choose a pixel for CSV export.", 3);
    return;
  }
  if (snapshotStore.length === 0) {
    setStatus("No saved indices available for pixel value export.", 3);
    return;
  }

  const rows = [
    ["index_name", "lat", "lon", "pixel_x", "pixel_y", "pixel_value", "status"].join(",")
  ];
  snapshotStore.forEach((snap) => {
    const sample = sampleSnapshotAtLatLon(snap, probeLatLng.lat, probeLatLng.lon);
    if (!sample) {
      rows.push(
        [
          `"${snap.indexLabel.replace(/"/g, '""')}"`,
          probeLatLng.lat.toFixed(6),
          probeLatLng.lon.toFixed(6),
          "",
          "",
          "",
          "outside_extent"
        ].join(",")
      );
      return;
    }
    rows.push(
      [
        `"${snap.indexLabel.replace(/"/g, '""')}"`,
        probeLatLng.lat.toFixed(6),
        probeLatLng.lon.toFixed(6),
        sample.x,
        sample.y,
        sample.value,
        "ok"
      ].join(",")
    );
  });

  const csv = `${rows.join("\n")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  triggerDownload(url, `pixel_value_${stamp}.csv`);
  URL.revokeObjectURL(url);
  setStatus("Pixel value CSV exported.", 3);
}

function updatePixelProbePanel() {
  if (!pixelCoords || !pixelValuesList) return;
  if (!probeLatLng) {
    pixelCoords.textContent = "Click the map to inspect a pixel.";
    pixelValuesList.innerHTML = '<p class="small">Pixel values will appear here once you click the map.</p>';
    drawPixelTrendChart([]);
    return;
  }

  pixelCoords.textContent = `Lat/Lon: ${probeLatLng.lat.toFixed(6)}, ${probeLatLng.lon.toFixed(6)}`;

  if (snapshotStore.length === 0) {
    pixelValuesList.innerHTML = '<p class="small">No saved indices available yet.</p>';
    drawPixelTrendChart([]);
    return;
  }

  pixelValuesList.innerHTML = "";
  snapshotStore.forEach((snap, i) => {
    const sample = sampleSnapshotAtLatLon(snap, probeLatLng.lat, probeLatLng.lon);
    const row = document.createElement("p");
    row.className = "small";
    const label = snap.indexLabel || `Index ${i + 1}`;
    row.textContent = sample
      ? `${label}: ${sample.value.toFixed(4)}`
      : `${label}: outside extent or unavailable`;
    pixelValuesList.appendChild(row);
  });

  const trendPoints = snapshotStore
    .map((snap) => {
      const sample = sampleSnapshotAtLatLon(snap, probeLatLng.lat, probeLatLng.lon);
      return sample ? { label: snap.indexLabel, value: sample.value } : null;
    })
    .filter(Boolean);
  drawPixelTrendChart(trendPoints);
}

function renderSnapshotSelect() {
  if (!snapshotSelect) return;
  snapshotSelect.innerHTML = "";
  snapshotStore.forEach((snap) => {
    const option = document.createElement("option");
    option.value = snap.id;
    option.textContent = snap.indexLabel;
    snapshotSelect.appendChild(option);
  });
  updateBlendControlVisibility();
  updateWorkflowProgress();
}

function saveSnapshot(imageUrl, values, label, formula, min, max) {
  const id = `snap_${snapshotCounter}`;
  snapshotCounter += 1;
  snapshotStore.push({
    id,
    imageUrl,
    values,
    indexLabel: label,
    formula,
    min,
    max,
    geoBounds: workingGeoBounds,
    width: workingWidth,
    height: workingHeight
  });
  renderSnapshotSelect();
  if (snapshotSelect) snapshotSelect.value = id;
  return id;
}

async function showSnapshotById(snapshotId) {
  const snap = snapshotStore.find((s) => s.id === snapshotId);
  if (!snap) {
    setStatus("Selected index was not found.", 4);
    return;
  }

  const img = new Image();
  img.src = snap.imageUrl;
  await img.decode();
  indexCanvas.width = snap.width;
  indexCanvas.height = snap.height;
  indexCtx.clearRect(0, 0, snap.width, snap.height);
  indexCtx.drawImage(img, 0, 0, snap.width, snap.height);
  updateMapOverlay(snap.imageUrl, snap.geoBounds);
  showComparisonForSnapshot(snapshotId);
  const snapshotIdx = snapshotStore.findIndex((s) => s.id === snapshotId);
  if (snapshotIdx > 0) {
    const prev = snapshotStore[snapshotIdx - 1];
    setStatus(
      `Showing "${snap.indexLabel}" with change slider against previous "${prev.indexLabel}". Range: ${snap.min.toFixed(4)} to ${snap.max.toFixed(4)}.`
    , 4);
    updatePixelProbePanel();
    return;
  }
  setStatus(`Showing index "${snap.indexLabel}". Range: ${snap.min.toFixed(4)} to ${snap.max.toFixed(4)}.`, 4);
  updatePixelProbePanel();
}

async function deleteSelectedSnapshot() {
  const selectedId = snapshotSelect && snapshotSelect.value ? snapshotSelect.value : "";
  if (!selectedId) {
    setStatus("No index selected to delete.", 4);
    return;
  }

  const idx = snapshotStore.findIndex((s) => s.id === selectedId);
  if (idx < 0) {
    setStatus("Selected index was not found.", 4);
    return;
  }

  const [removed] = snapshotStore.splice(idx, 1);
  renderSnapshotSelect();

  if (snapshotStore.length === 0) {
    indexCtx.clearRect(0, 0, indexCanvas.width, indexCanvas.height);
    if (map && mapBaseOverlay) {
      map.removeLayer(mapBaseOverlay);
      mapBaseOverlay = null;
    }
    clearComparisonOverlay();
    updatePixelProbePanel();
    setStatus(`Deleted "${removed.indexLabel}". No saved indices remain.`, 4);
    return;
  }

  const nextIdx = Math.min(idx, snapshotStore.length - 1);
  const next = snapshotStore[nextIdx];
  if (snapshotSelect) snapshotSelect.value = next.id;
  try {
    await showSnapshotById(next.id);
    setStatus(`Deleted "${removed.indexLabel}". Showing "${next.indexLabel}".`, 4);
  } catch (err) {
    setStatus(`Deleted "${removed.indexLabel}", but could not load the next index: ${err.message}`, 4);
  }
}

function showComparisonForSnapshot(snapshotId) {
  const targetIdx = snapshotStore.findIndex((s) => s.id === snapshotId);
  if (targetIdx <= 0) {
    clearComparisonOverlay();
    applyMapOverlayOpacity();
    updatePixelProbePanel();
    return;
  }

  const base = snapshotStore[targetIdx - 1];
  const target = snapshotStore[targetIdx];
  if (!base.geoBounds || !target.geoBounds) {
    clearComparisonOverlay();
    applyMapOverlayOpacity();
    return;
  }

  const baseBounds = [
    [base.geoBounds[1], base.geoBounds[0]],
    [base.geoBounds[3], base.geoBounds[2]]
  ];
  const targetBounds = [
    [target.geoBounds[1], target.geoBounds[0]],
    [target.geoBounds[3], target.geoBounds[2]]
  ];

  initMap();
  if (!map) return;

  if (!mapBaseOverlay) {
    mapBaseOverlay = L.imageOverlay(base.imageUrl, baseBounds, { interactive: true }).addTo(map);
  } else {
    mapBaseOverlay.setUrl(base.imageUrl);
    mapBaseOverlay.setBounds(baseBounds);
  }

  if (!mapCompareOverlay) {
    mapCompareOverlay = L.imageOverlay(target.imageUrl, targetBounds, { interactive: true }).addTo(map);
  } else {
    mapCompareOverlay.setUrl(target.imageUrl);
    mapCompareOverlay.setBounds(targetBounds);
  }

  applyMapOverlayOpacity();
  map.fitBounds(targetBounds, { padding: [20, 20] });
  setTimeout(() => map.invalidateSize(), 0);
  updatePixelProbePanel();
}

function uniqueBandName(baseName) {
  if (!bandStore.has(baseName)) return baseName;
  let suffix = 2;
  while (bandStore.has(`${baseName} [${suffix}]`)) suffix += 1;
  return `${baseName} [${suffix}]`;
}

function baseAliasFromName(name) {
  const withoutBandTag = name.replace(/\s*\[Band \d+\]\s*$/i, "");
  const withoutExt = withoutBandTag.replace(/\.[^.]+$/, "");
  let alias = withoutExt.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!alias) alias = "BAND";
  if (/^[0-9]/.test(alias)) alias = `B_${alias}`;
  return alias.toUpperCase();
}

function isValidAlias(text) {
  return text.trim().length > 0;
}

function ensureUniqueAlias(baseAlias, rawName) {
  const existing = new Set(
    [...aliasStore.entries()].filter(([name]) => name !== rawName).map(([, alias]) => alias)
  );
  let normalizedBase = baseAlias.trim();
  if (!existing.has(normalizedBase)) return normalizedBase;
  let i = 2;
  while (existing.has(`${normalizedBase} (${i})`)) i += 1;
  return `${normalizedBase} (${i})`;
}

function setDefaultAlias(rawName) {
  const alias = ensureUniqueAlias(baseAliasFromName(rawName).replace(/_/g, " "), rawName);
  aliasStore.set(rawName, alias);
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
  const geoBounds = extractWgs84BoundsFromImage(image);
  const sampleIndexes = Array.from({ length: samples }, (_, i) => i);
  const rasters = await image.readRasters({ samples: sampleIndexes });

  if (samples === 1) {
    return [
      {
        name: file.name,
        payload: {
          values: normalizeReflectance(Float32Array.from(rasters[0])),
          width,
          height,
          geoBounds
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
        height,
        geoBounds
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

function renderAliasEditor() {
  bandAliasList.innerHTML = "";
  [...bandStore.keys()].forEach((rawName) => {
    const wrapper = document.createElement("label");
    wrapper.className = "alias-row";

    const source = document.createElement("small");
    source.textContent = `Source: ${rawName}`;
    wrapper.appendChild(source);

    const input = document.createElement("input");
    input.type = "text";
    input.value = aliasStore.get(rawName) || "";
    input.dataset.rawName = rawName;
    input.placeholder = "Alias (e.g., NIR)";
    input.addEventListener("change", () => {
      const proposed = input.value.trim();
      if (!isValidAlias(proposed)) {
        input.value = aliasStore.get(rawName) || "";
        setStatus("Alias cannot be empty.", 2);
        return;
      }
      const normalized = ensureUniqueAlias(proposed, rawName);
      if (normalized !== proposed) {
        input.value = normalized;
        setStatus(`Alias "${proposed}" was already in use. Renamed to "${normalized}".`, 2);
      }
      aliasStore.set(rawName, normalized);
      aliasConfirmedStore.add(rawName);
      reviewBandsAccepted = false;
      setStatus("Alias updated. Press OK when done.", 2);
      renderFormulaHint();
      updateWorkflowProgress();
    });
    wrapper.appendChild(input);
    bandAliasList.appendChild(wrapper);
  });
}

function renderFormulaHint() {
  if (!formulaHint) return;
  const names = [...bandStore.keys()];
  if (names.length === 0) {
    formulaHint.textContent = "";
    return;
  }
  const aliasRefs = [...aliasStore.entries()].map(([raw, alias]) => `{${alias}}=[${raw}]`).join(", ");
  formulaHint.textContent = `Aliases: ${aliasRefs}. Helpers: ${Object.keys(rasterFns).join(", ")}. Constants: ${Object.keys(rasterConsts).join(", ")}.`;
}

function renderPreview() {
  const loaded = [...bandStore.values()];
  if (loaded.length === 0) return;

  const w = workingWidth;
  const h = workingHeight;
  previewCanvas.width = w;
  previewCanvas.height = h;
  const img = previewCtx.createImageData(w, h);

  const redVals = loaded[0].values;
  const greenVals = (loaded[1] || loaded[0]).values;
  const blueVals = (loaded[2] || loaded[0]).values;
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
  if (!/^[^`;$\\]+$/.test(rawFormula)) {
    throw new Error("Formula contains unsupported characters.");
  }

  const refs = new Map();
  const aliasRefs = new Map();
  const helperNames = Object.keys(rasterFns);
  const constNames = Object.keys(rasterConsts);
  const reserved = new Set([...helperNames, ...constNames]);
  let refIndex = 0;
  let transformed = normalized.replace(/\[([^\]]+)\]/g, (_, label) => {
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

  transformed = transformed.replace(/\{([^}]+)\}/g, (_, label) => {
    const aliasName = label.trim();
    const rawMatch = [...aliasStore.entries()].find(([, alias]) => alias === aliasName);
    if (!rawMatch) {
      throw new Error(`Unknown alias "${aliasName}". Check the alias list.`);
    }
    if (!aliasRefs.has(aliasName)) {
      aliasRefs.set(aliasName, `A${aliasRefs.size}`);
    }
    return aliasRefs.get(aliasName);
  });

  // Also support alias usage without curly braces for identifier-like aliases (e.g., B4, NIR).
  const aliasCandidates = [...aliasStore.values()]
    .filter((alias) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(alias) && !reserved.has(alias))
    .sort((a, b) => b.length - a.length);
  aliasCandidates.forEach((aliasName) => {
    if (!aliasRefs.has(aliasName)) {
      aliasRefs.set(aliasName, `A${aliasRefs.size}`);
    }
    const symbol = aliasRefs.get(aliasName);
    const pattern = new RegExp(`\\b${aliasName}\\b`, "g");
    transformed = transformed.replace(pattern, symbol);
  });

  if (transformed.includes("[") || transformed.includes("]")) {
    throw new Error("Malformed band reference. Use [exact band name].");
  }
  if (transformed.includes("{") || transformed.includes("}")) {
    throw new Error("Malformed alias reference. Use {exact alias text}.");
  }

  const bandRefs = [...refs.entries()].map(([name, symbol]) => ({ name, symbol }));
  const bandSymbols = bandRefs.map((entry) => entry.symbol);
  const aliasRefsList = [...aliasRefs.entries()].map(([name, symbol]) => ({ name, symbol }));
  const aliasSymbols = aliasRefsList.map((entry) => entry.symbol);
  const aliasToRaw = new Map([...aliasStore.entries()].map(([raw, alias]) => [alias, raw]));
  const allowed = new Set([...bandSymbols, ...aliasSymbols, ...helperNames, ...constNames]);
  const identifiers = transformed.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];

  for (const id of identifiers) {
    if (!allowed.has(id)) {
      throw new Error(`Unknown token "${id}". Use alias names (no braces needed), [band name], and supported helpers.`);
    }
  }

  const evaluator = new Function(
    ...aliasSymbols,
    ...bandSymbols,
    ...helperNames,
    ...constNames,
    `"use strict"; return (${transformed});`
  );

  return {
    aliasRefs: aliasRefsList,
    aliasToRaw,
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
    setStatus("Enter a raster algebra formula.", 3);
    updateWorkflowProgress();
    return;
  }

  if (bandStore.size === 0) {
    setStatus("Upload at least one band first.", 3);
    updateWorkflowProgress();
    return;
  }

  let compiled;
  try {
    compiled = compileRasterFormula(formula);
  } catch (err) {
    setStatus(err.message, 3);
    updateWorkflowProgress();
    return;
  }

  const { aliasRefs, aliasToRaw, bandRefs, helperNames, constNames, evaluator } = compiled;
  const aliasArrays = aliasRefs.map((entry) => bandStore.get(aliasToRaw.get(entry.name)).values);
  const bandArrays = bandRefs.map((entry) => bandStore.get(entry.name).values);
  const helperFns = helperNames.map((name) => rasterFns[name]);
  const constValues = constNames.map((name) => rasterConsts[name]);
  const out = new Float32Array(workingWidth * workingHeight);
  let min = Infinity;
  let max = -Infinity;
  const evalArgs = new Array(aliasArrays.length + bandArrays.length + helperFns.length + constValues.length);

  for (let i = 0; i < out.length; i += 1) {
    let argIdx = 0;
    for (let j = 0; j < aliasArrays.length; j += 1) {
      evalArgs[argIdx] = aliasArrays[j][i];
      argIdx += 1;
    }
    for (let j = 0; j < bandArrays.length; j += 1) {
      evalArgs[argIdx] = bandArrays[j][i];
      argIdx += 1;
    }
    for (let j = 0; j < helperFns.length; j += 1) {
      evalArgs[argIdx] = helperFns[j];
      argIdx += 1;
    }
    for (let j = 0; j < constValues.length; j += 1) {
      evalArgs[argIdx] = constValues[j];
      argIdx += 1;
    }
    let value = 0;
    try {
      value = evaluator(...evalArgs);
    } catch (err) {
      setStatus(`Formula evaluation failed near pixel ${i}: ${err.message}`, 3);
      updateWorkflowProgress();
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
  const imageUrl = indexCanvas.toDataURL("image/png");
  const snapshotId = saveSnapshot(imageUrl, out, label, formula, min, max);
  newIndexCyclePending = false;
  updateMapOverlay(imageUrl, workingGeoBounds);
  showComparisonForSnapshot(snapshotId);
  setStatus(
    `${label} computed on ${workingWidth} x ${workingHeight} using "${formula}". Range: ${min.toFixed(4)} to ${max.toFixed(4)}. Saved to indices (${snapshotStore.length}).`
  , 3);
  updateWorkflowProgress();
}

async function ingestFile(file) {
  const lower = file.name.toLowerCase();
  const isTiff = lower.endsWith(".tif") || lower.endsWith(".tiff");
  if (isTiff) {
    const entries = await readGeoTiffBands(file);
    entries.forEach((entry) => {
      const rawName = uniqueBandName(entry.name);
      bandStore.set(rawName, entry.payload);
      setDefaultAlias(rawName);
    });
    return;
  }

  const payload = await readImageBand(file);
  const rawName = uniqueBandName(file.name);
  bandStore.set(rawName, payload);
  setDefaultAlias(rawName);
}

async function handleFiles(files) {
  if (!files || files.length === 0) return;
  setStatus("Reading uploaded files...", 1);

  bandStore.clear();
  aliasStore.clear();
  aliasConfirmedStore.clear();
  reviewBandsAccepted = false;
  for (let i = 0; i < files.length; i += 1) {
    try {
      await ingestFile(files[i]);
    } catch (err) {
      console.error(err);
      setStatus(`Error reading ${files[i].name}.`, 1);
    }
  }

  if (bandStore.size === 0) {
    setStatus("No readable raster bands were found in the selected files.", 1);
    renderAliasEditor();
    renderFormulaHint();
    updateWorkflowProgress();
    return;
  }

  const dims = [...bandStore.values()].map((b) => ({ w: b.width, h: b.height }));
  workingWidth = Math.min(...dims.map((d) => d.w));
  workingHeight = Math.min(...dims.map((d) => d.h));
  workingGeoBounds = [...bandStore.values()].find((b) => b.geoBounds)?.geoBounds || null;

  bandStore.forEach((payload, key) => {
    const resampled = resampleNearest(payload.values, payload.width, payload.height, workingWidth, workingHeight);
    bandStore.set(key, {
      values: resampled,
      width: workingWidth,
      height: workingHeight,
      geoBounds: payload.geoBounds || null
    });
  });

  renderAliasEditor();
  renderFormulaHint();
  renderPreview();
  indexCtx.clearRect(0, 0, indexCanvas.width, indexCanvas.height);
  setStatus(`Loaded ${bandStore.size} bands. Continue to Step 2 to set aliases.`, 1);
  updateWorkflowProgress();
}

initMap();
setOverlayOpacityFromInput();
setCompareBlendFromInput();
updateBlendControlVisibility();
updateClearVectorButtonVisibility();

if (overlayOpacityInput) {
  overlayOpacityInput.addEventListener("change", setOverlayOpacityFromInput);
}
if (reviewBandsOkBtn) {
  reviewBandsOkBtn.addEventListener("click", confirmReviewBands);
}
if (compareBlendInput) {
  compareBlendInput.addEventListener("input", setCompareBlendFromInput);
}
if (showSnapshotBtn) {
  showSnapshotBtn.addEventListener("click", async () => {
    const id = snapshotSelect ? snapshotSelect.value : "";
    if (!id) {
      setStatus("No index selected yet.", 4);
      return;
    }
    try {
      await showSnapshotById(id);
    } catch (err) {
      setStatus(`Could not show index: ${err.message}`, 4);
    }
  });
}
if (newIndexBtn) {
  newIndexBtn.addEventListener("click", startNewIndexCycle);
}
if (deleteSnapshotBtn) {
  deleteSnapshotBtn.addEventListener("click", async () => {
    await deleteSelectedSnapshot();
  });
}
if (snapshotSelect) {
  snapshotSelect.addEventListener("change", async () => {
    const id = snapshotSelect.value;
    if (!id) return;
    try {
      await showSnapshotById(id);
    } catch (err) {
      setStatus(`Could not show index: ${err.message}`, 4);
    }
  });
}
if (exportProbeCsvBtn) {
  exportProbeCsvBtn.addEventListener("click", exportPixelProbeCsv);
}
if (vectorFileInput) {
  vectorFileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    handleVectorFileUpload(file);
  });
}
if (clearVectorBtn) {
  clearVectorBtn.addEventListener("click", () => {
    clearVectorOverlay();
    setStatus("Vector overlay cleared.", 4);
  });
}

fileInput.addEventListener("change", (e) => {
  const files = e.target.files;
  handleFiles(files);
});

computeBtn.addEventListener("click", computeIndex);
updateWorkflowProgress();
