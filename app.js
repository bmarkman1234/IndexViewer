const statusStep1 = document.getElementById("statusStep1");
const statusStep2 = document.getElementById("statusStep2");
const statusStep3 = document.getElementById("statusStep3");
const statusStep4 = document.getElementById("statusStep4");
const indexLabel = document.getElementById("indexLabel");
const indexTypeSelect = document.getElementById("indexTypeSelect");
const step1OkBtn = document.getElementById("step1OkBtn");
const nirBandFileInput = document.getElementById("nirBandFile");
const secondaryBandFileInput = document.getElementById("secondaryBandFile");
const secondaryBandLabel = document.getElementById("secondaryBandLabel");
const bandUploadHint = document.getElementById("bandUploadHint");
const rampSelect = document.getElementById("rampSelect");
const formulaHint = document.getElementById("formulaHint");
const computeBtn = document.getElementById("computeBtn");
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
let measureMode = false;
let measurePoints = [];
let measureMarkers = [];
let measurePolyline = null;
let measureLayerGroup = null;
let measureToggleEl = null;
let measureReadoutEl = null;
let overlayOpacity = 0.7;
let compareBlend = 0.5;
let probeLatLng = null;
let snapshotCounter = 0;
let newIndexCyclePending = false;
let step1Confirmed = false;
const snapshotStore = [];
const OVERLAY_MAX_EDGE = 1800;
const OVERLAY_MAX_PIXELS = 2_000_000;

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

const rampOptionsByType = {
  ndvi: [
    { value: "ndvi-classic", label: "NDVI Classic" },
    { value: "ndvi-contrast", label: "NDVI High Contrast" }
  ],
  nbr: [
    { value: "nbr-burn", label: "NBR Burn Severity" },
    { value: "nbr-diverging", label: "NBR Diverging" }
  ]
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

function formatMeasureDistance(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return "0 m";
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${meters.toFixed(1)} m`;
}

function getMeasureDistanceMeters() {
  if (!map || measurePoints.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < measurePoints.length; i += 1) {
    total += map.distance(measurePoints[i - 1], measurePoints[i]);
  }
  return total;
}

function updateMeasureReadout() {
  if (!measureReadoutEl) return;
  if (!measureMode && measurePoints.length === 0) {
    measureReadoutEl.textContent = "Off";
    return;
  }
  if (measurePoints.length === 0) {
    measureReadoutEl.textContent = "Click map to start";
    return;
  }
  if (measurePoints.length === 1) {
    measureReadoutEl.textContent = "1 point";
    return;
  }
  measureReadoutEl.textContent = formatMeasureDistance(getMeasureDistanceMeters());
}

function syncMeasureGeometry() {
  if (!map || !measureLayerGroup) return;
  if (measurePolyline) {
    measureLayerGroup.removeLayer(measurePolyline);
    measurePolyline = null;
  }
  measureMarkers.forEach((marker) => {
    measureLayerGroup.removeLayer(marker);
  });
  measureMarkers = [];

  if (measurePoints.length === 0) {
    updateMeasureReadout();
    return;
  }

  measurePoints.forEach((latlng) => {
    const marker = L.circleMarker(latlng, {
      radius: 4,
      color: "#111111",
      weight: 1,
      fillColor: "#ffffff",
      fillOpacity: 1
    });
    measureLayerGroup.addLayer(marker);
    measureMarkers.push(marker);
  });

  if (measurePoints.length > 1) {
    measurePolyline = L.polyline(measurePoints, {
      color: "#111111",
      weight: 2
    });
    measureLayerGroup.addLayer(measurePolyline);
  }
  updateMeasureReadout();
}

function clearMeasure() {
  measurePoints = [];
  syncMeasureGeometry();
}

function setMeasureMode(active) {
  measureMode = !!active;
  if (measureToggleEl) {
    measureToggleEl.classList.toggle("active", measureMode);
    measureToggleEl.setAttribute("aria-pressed", measureMode ? "true" : "false");
  }
  updateMeasureReadout();
}

function addMeasurePoint(latlng) {
  measurePoints.push(latlng);
  syncMeasureGeometry();
}

function addMeasureControl() {
  if (!map || !window.L) return;
  measureLayerGroup = L.layerGroup().addTo(map);
  const measureControl = L.control({ position: "bottomleft" });
  measureControl.onAdd = () => {
    const container = L.DomUtil.create("div", "leaflet-bar measure-control");
    const toggle = L.DomUtil.create("button", "measure-toggle", container);
    toggle.type = "button";
    toggle.textContent = "Measure";
    toggle.setAttribute("aria-label", "Toggle map measure tool");
    toggle.setAttribute("aria-pressed", "false");

    const clear = L.DomUtil.create("button", "measure-clear", container);
    clear.type = "button";
    clear.textContent = "Clear";
    clear.setAttribute("aria-label", "Clear measured path");

    const readout = L.DomUtil.create("div", "measure-readout", container);
    readout.textContent = "Off";

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(toggle, "click", () => setMeasureMode(!measureMode));
    L.DomEvent.on(clear, "click", () => clearMeasure());

    measureToggleEl = toggle;
    measureReadoutEl = readout;
    return container;
  };
  measureControl.addTo(map);
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
  const hasModeSelected = step1Confirmed && (getCurrentIndexType() === "ndvi" || getCurrentIndexType() === "nbr");
  const secondRole = getSecondaryRoleKey();
  const hasBands = bandStore.has("NIR") && bandStore.has(secondRole);
  const hasSavedSnapshots = snapshotStore.length > 0;
  const hasComputed = hasSavedSnapshots && !newIndexCyclePending;
  const hasSavedForCompare = hasSavedSnapshots && !newIndexCyclePending;

  const completedCount = [hasModeSelected, hasBands, hasComputed, hasSavedForCompare].filter(Boolean).length;
  const firstIncomplete = !hasModeSelected ? 1 : !hasBands ? 2 : !hasComputed ? 3 : !hasSavedForCompare ? 4 : 0;

  applyStepState(step1, step1State, hasModeSelected ? "complete" : firstIncomplete === 1 ? "in-progress" : "pending", hasModeSelected ? "Complete" : firstIncomplete === 1 ? "In Progress" : "Pending");
  applyStepState(step2, step2State, hasBands ? "complete" : firstIncomplete === 2 ? "in-progress" : "pending", hasBands ? "Complete" : firstIncomplete === 2 ? "In Progress" : "Pending");
  applyStepState(step3, step3State, hasComputed ? "complete" : firstIncomplete === 3 ? "in-progress" : "pending", hasComputed ? "Complete" : firstIncomplete === 3 ? "In Progress" : "Pending");
  applyStepState(step4, step4State, hasSavedForCompare ? "complete" : firstIncomplete === 4 ? "in-progress" : "pending", hasSavedForCompare ? "Complete" : firstIncomplete === 4 ? "In Progress" : "Pending");

  if (workflowProgressText) workflowProgressText.textContent = `${completedCount} of 4 steps complete`;
  if (workflowProgressFill) workflowProgressFill.style.width = `${(completedCount / 4) * 100}%`;
}

function confirmStep1Selection() {
  step1Confirmed = true;
  setStatus(`Selected ${getCurrentIndexType().toUpperCase()}. Continue to Step 2 uploads.`, 1);
  updateWorkflowProgress();
}

function getCurrentIndexType() {
  if (!indexTypeSelect) return "ndvi";
  return indexTypeSelect.value === "nbr" ? "nbr" : "ndvi";
}

function getSecondaryRoleKey(indexType = getCurrentIndexType()) {
  return indexType === "nbr" ? "SWIR2" : "RED";
}

function getIndexFormulaText(indexType = getCurrentIndexType()) {
  if (indexType === "nbr") return "(NIR - SWIR2) / (NIR + SWIR2)";
  return "(NIR - Red) / (NIR + Red)";
}

function updateRampSelect() {
  if (!rampSelect) return;
  const indexType = getCurrentIndexType();
  const options = rampOptionsByType[indexType] || rampOptionsByType.ndvi;
  const previous = rampSelect.value;
  rampSelect.innerHTML = "";
  options.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.value;
    option.textContent = entry.label;
    rampSelect.appendChild(option);
  });
  const stillValid = options.some((entry) => entry.value === previous);
  rampSelect.value = stillValid ? previous : options[0].value;
}

function updateStep3ModeUi() {
  const indexType = getCurrentIndexType();
  const secondaryRoleKey = getSecondaryRoleKey(indexType);
  if (secondaryBandLabel) secondaryBandLabel.textContent = secondaryRoleKey === "SWIR2" ? "SWIR2 Band" : "Red Band";
  if (bandUploadHint) bandUploadHint.textContent = secondaryRoleKey === "SWIR2"
    ? "Upload one NIR band and one SWIR2 band for NBR."
    : "Upload one NIR band and one Red band for NDVI.";
  updateRampSelect();
  if (!formulaHint) return;
  formulaHint.textContent = `${indexType.toUpperCase()} formula: ${getIndexFormulaText(indexType)}`;
}

function startNewIndexCycle() {
  bandStore.clear();
  workingWidth = 0;
  workingHeight = 0;
  workingGeoBounds = null;
  if (nirBandFileInput) nirBandFileInput.value = "";
  if (secondaryBandFileInput) secondaryBandFileInput.value = "";
  renderFormulaHint();
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  indexCtx.clearRect(0, 0, indexCanvas.width, indexCanvas.height);
  if (map && mapBaseOverlay) {
    map.removeLayer(mapBaseOverlay);
    mapBaseOverlay = null;
  }
  clearComparisonOverlay();

  newIndexCyclePending = true;
  step1Confirmed = false;
  updateWorkflowProgress();
  if (indexLabel) indexLabel.focus();
  setStatus("Reset to Step 1. Choose index type, then upload required bands in Step 2.", 1);
  setStatus("Waiting for required band uploads.", 2);
}

function initMap() {
  if (map || !window.L || !mapContainer) return;
  map = L.map("mapContainer", { zoomControl: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
  map.setView([20, 0], 2);
  addMeasureControl();
  map.on("click", (e) => {
    if (measureMode) {
      addMeasurePoint(e.latlng);
      return;
    }
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
  // Legacy no-op: alias review removed in simplified NDVI/NBR workflow.
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
  if (snapshotStore.length === 0) {
    setStatus("No saved indices yet.", 4);
  } else if (snapshotStore.length === 1) {
    setStatus(`1 saved index available: "${snapshotStore[0].indexLabel}".`, 4);
  } else {
    setStatus(`${snapshotStore.length} saved indices available for comparison.`, 4);
  }
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
  const removedBlobUrl =
    removed && typeof removed.imageUrl === "string" && removed.imageUrl.startsWith("blob:")
      ? removed.imageUrl
      : null;
  renderSnapshotSelect();

  if (snapshotStore.length === 0) {
    indexCtx.clearRect(0, 0, indexCanvas.width, indexCanvas.height);
    if (map && mapBaseOverlay) {
      map.removeLayer(mapBaseOverlay);
      mapBaseOverlay = null;
    }
    clearComparisonOverlay();
    updatePixelProbePanel();
    if (removedBlobUrl) URL.revokeObjectURL(removedBlobUrl);
    setStatus(`Deleted "${removed.indexLabel}". No saved indices remain.`, 4);
    return;
  }

  const nextIdx = Math.min(idx, snapshotStore.length - 1);
  const next = snapshotStore[nextIdx];
  if (snapshotSelect) snapshotSelect.value = next.id;
  try {
    await showSnapshotById(next.id);
    if (removedBlobUrl) URL.revokeObjectURL(removedBlobUrl);
    setStatus(`Deleted "${removed.indexLabel}". Showing "${next.indexLabel}".`, 4);
  } catch (err) {
    if (removedBlobUrl) URL.revokeObjectURL(removedBlobUrl);
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
  // Legacy no-op: alias editor removed in simplified NDVI/NBR workflow.
}

function canvasToPngObjectUrl(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to encode overlay image."));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

function getOverlayRenderSize(srcWidth, srcHeight) {
  if (!(srcWidth > 0) || !(srcHeight > 0)) {
    return { width: 1, height: 1 };
  }
  const edgeScale = Math.min(OVERLAY_MAX_EDGE / srcWidth, OVERLAY_MAX_EDGE / srcHeight, 1);
  const pixelScale = Math.min(1, Math.sqrt(OVERLAY_MAX_PIXELS / (srcWidth * srcHeight)));
  const scale = Math.min(edgeScale, pixelScale);
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));
  return { width, height };
}

function renderFormulaHint() {
  updateStep3ModeUi();
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

function colorizeCustomContrast(t) {
  const x = Math.pow(Math.max(0, Math.min(1, t)), 0.85);
  if (x < 0.2) return [12, 56, 120];
  if (x < 0.4) return [56, 132, 201];
  if (x < 0.6) return [242, 229, 171];
  if (x < 0.8) return [104, 174, 92];
  return [22, 107, 58];
}

function interpolateStops(stops, value) {
  const low = stops[0][0];
  const high = stops[stops.length - 1][0];
  const x = Math.max(low, Math.min(high, value));
  for (let i = 1; i < stops.length; i += 1) {
    const [x1, c1] = stops[i];
    const [x0, c0] = stops[i - 1];
    if (x <= x1) {
      const span = x1 - x0 || 1;
      const t = (x - x0) / span;
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * t),
        Math.round(c0[1] + (c1[1] - c0[1]) * t),
        Math.round(c0[2] + (c1[2] - c0[2]) * t)
      ];
    }
  }
  return stops[stops.length - 1][1];
}

function colorizeNdviRamp(value, rampId) {
  if (rampId === "ndvi-contrast") {
    const stops = [
      [-1.0, [8, 36, 85]],
      [-0.2, [56, 118, 178]],
      [0.0, [170, 158, 128]],
      [0.2, [206, 221, 138]],
      [0.4, [129, 189, 92]],
      [0.6, [57, 152, 70]],
      [0.8, [12, 108, 49]],
      [1.0, [2, 72, 30]]
    ];
    return interpolateStops(stops, value);
  }
  const stops = [
    [-1.0, [20, 58, 110]],
    [-0.2, [72, 136, 188]],
    [0.0, [186, 174, 141]],
    [0.2, [196, 215, 134]],
    [0.4, [128, 186, 103]],
    [0.6, [64, 151, 84]],
    [0.8, [24, 112, 62]],
    [1.0, [8, 74, 40]]
  ];
  return interpolateStops(stops, value);
}

function colorizeNbrRamp(value, rampId) {
  if (rampId === "nbr-diverging") {
    const stops = [
      [-1.0, [33, 88, 156]],
      [-0.4, [113, 164, 216]],
      [0.0, [241, 241, 241]],
      [0.4, [241, 150, 97]],
      [1.0, [165, 0, 38]]
    ];
    return interpolateStops(stops, value);
  }
  const stops = [
    [-1.0, [25, 92, 162]],
    [-0.2, [70, 151, 110]],
    [0.0, [218, 205, 170]],
    [0.2, [242, 176, 109]],
    [0.45, [224, 102, 64]],
    [0.7, [171, 39, 44]],
    [1.0, [94, 0, 20]]
  ];
  return interpolateStops(stops, value);
}

function computeHistogramPercentile(values, minValue, maxValue, percentile, bins = 1024) {
  const p = Math.max(0, Math.min(1, percentile));
  const span = maxValue - minValue;
  if (!(span > 0)) return minValue;

  const histogram = new Uint32Array(bins);
  let count = 0;
  for (let i = 0; i < values.length; i += 1) {
    const numeric = Number(values[i]);
    if (!Number.isFinite(numeric)) continue;
    const clamped = Math.max(minValue, Math.min(maxValue, numeric));
    let idx = Math.floor(((clamped - minValue) / span) * (bins - 1));
    if (idx < 0) idx = 0;
    if (idx >= bins) idx = bins - 1;
    histogram[idx] += 1;
    count += 1;
  }
  if (count === 0) return minValue;

  const target = Math.max(1, Math.ceil(count * p));
  let cumulative = 0;
  for (let i = 0; i < bins; i += 1) {
    cumulative += histogram[i];
    if (cumulative >= target) {
      return minValue + (i / (bins - 1)) * span;
    }
  }
  return maxValue;
}

function getPresetStretch(values) {
  let p2 = computeHistogramPercentile(values, -1, 1, 0.02, 1024);
  let p98 = computeHistogramPercentile(values, -1, 1, 0.98, 1024);
  if (p98 <= p2) {
    p2 = -0.2;
    p98 = 0.8;
  }
  return { min: p2, max: p98 };
}

function getColorForValue(value, renderer) {
  if (renderer.type === "ndvi") {
    const clipped = Math.max(-1, Math.min(1, value));
    const t = (clipped - renderer.stretchMin) / renderer.stretchSpan;
    const contrastT = Math.pow(Math.max(0, Math.min(1, t)), 0.9);
    const adjusted = renderer.stretchMin + contrastT * renderer.stretchSpan;
    return colorizeNdviRamp(adjusted, renderer.rampId);
  }
  if (renderer.type === "nbr") {
    const clipped = Math.max(-1, Math.min(1, value));
    const t = (clipped - renderer.stretchMin) / renderer.stretchSpan;
    const contrastT = Math.pow(Math.max(0, Math.min(1, t)), 0.9);
    const adjusted = renderer.stretchMin + contrastT * renderer.stretchSpan;
    return colorizeNbrRamp(adjusted, renderer.rampId);
  }
  const t = (value - renderer.min) / renderer.span;
  return colorizeCustomContrast(t);
}

async function computeIndex() {
  if (computeBtn) computeBtn.disabled = true;
  if (!step1Confirmed) {
    setStatus("Press OK in Step 1 before calculating.", 3);
    updateWorkflowProgress();
    if (computeBtn) computeBtn.disabled = false;
    return;
  }
  const indexType = getCurrentIndexType();
  const rampId = rampSelect ? rampSelect.value : indexType === "nbr" ? "nbr-burn" : "ndvi-classic";
  const secondRole = getSecondaryRoleKey(indexType);
  const formula = getIndexFormulaText(indexType);
  const label = indexLabel.value.trim() || indexType.toUpperCase();

  const nirBand = bandStore.get("NIR");
  const secondBand = bandStore.get(secondRole);
  if (!nirBand || !secondBand) {
    setStatus(`Upload required ${indexType.toUpperCase()} bands in Step 2 first.`, 3);
    updateWorkflowProgress();
    if (computeBtn) computeBtn.disabled = false;
    return;
  }

  const nirValues = nirBand.values;
  const secondValues = secondBand.values;
  const out = new Float32Array(workingWidth * workingHeight);
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < out.length; i += 1) {
    const numerator = nirValues[i] - secondValues[i];
    const denominator = nirValues[i] + secondValues[i];
    const value = Math.abs(denominator) < 1e-10 ? 0 : numerator / denominator;
    const safeValue = Number.isFinite(value) ? value : 0;
    out[i] = safeValue;
    if (safeValue < min) min = safeValue;
    if (safeValue > max) max = safeValue;
  }

  const overlaySize = getOverlayRenderSize(workingWidth, workingHeight);
  indexCanvas.width = overlaySize.width;
  indexCanvas.height = overlaySize.height;
  const img = indexCtx.createImageData(overlaySize.width, overlaySize.height);
  const span = max - min || 1;
  const renderer = {
    type: indexType,
    rampId,
    min,
    span
  };
  if (indexType === "ndvi" || indexType === "nbr") {
    const stretch = getPresetStretch(out);
    renderer.stretchMin = stretch.min;
    renderer.stretchSpan = Math.max(1e-6, stretch.max - stretch.min);
  }

  for (let y = 0; y < overlaySize.height; y += 1) {
    const srcY = Math.floor((y / overlaySize.height) * workingHeight);
    for (let x = 0; x < overlaySize.width; x += 1) {
      const srcX = Math.floor((x / overlaySize.width) * workingWidth);
      const srcIdx = Math.min(out.length - 1, srcY * workingWidth + srcX);
      const [r, g, bColor] = getColorForValue(out[srcIdx], renderer);
      const p = (y * overlaySize.width + x) * 4;
      img.data[p] = r;
      img.data[p + 1] = g;
      img.data[p + 2] = bColor;
      img.data[p + 3] = 255;
    }
  }
  indexCtx.putImageData(img, 0, 0);
  let imageUrl = "";
  try {
    imageUrl = await canvasToPngObjectUrl(indexCanvas);
  } catch (err) {
    setStatus(`Could not render overlay image: ${err.message}`, 3);
    updateWorkflowProgress();
    if (computeBtn) computeBtn.disabled = false;
    return;
  }
  const snapshotId = saveSnapshot(imageUrl, out, label, formula, min, max);
  newIndexCyclePending = false;
  updateMapOverlay(imageUrl, workingGeoBounds);
  showComparisonForSnapshot(snapshotId);
  setStatus(
    `${label} (${indexType.toUpperCase()}) computed on ${workingWidth} x ${workingHeight} using "${formula}". Range: ${min.toFixed(4)} to ${max.toFixed(4)}. Saved to indices (${snapshotStore.length}). Overlay preview: ${overlaySize.width} x ${overlaySize.height}.`
  , 3);
  updateWorkflowProgress();
  if (computeBtn) computeBtn.disabled = false;
}

async function readSingleBandFile(file, roleKey) {
  const lower = file.name.toLowerCase();
  const isTiff = lower.endsWith(".tif") || lower.endsWith(".tiff");
  if (isTiff) {
    const entries = await readGeoTiffBands(file);
    if (!entries || entries.length === 0) throw new Error(`No readable raster data in ${file.name}.`);
    if (entries.length > 1) {
      setStatus(`${roleKey}: ${file.name} has multiple bands; using Band 1.`, 2);
    }
    return entries[0].payload;
  }
  return readImageBand(file);
}

function alignRoleBandsForCompute() {
  const secondRole = getSecondaryRoleKey();
  const nir = bandStore.get("NIR");
  const second = bandStore.get(secondRole);
  if (!nir || !second) {
    if (nir) {
      workingWidth = nir.width;
      workingHeight = nir.height;
      workingGeoBounds = nir.geoBounds || null;
    } else {
      workingWidth = 0;
      workingHeight = 0;
      workingGeoBounds = null;
    }
    return false;
  }

  const targetWidth = Math.min(nir.width, second.width);
  const targetHeight = Math.min(nir.height, second.height);
  workingWidth = targetWidth;
  workingHeight = targetHeight;
  workingGeoBounds = nir.geoBounds || second.geoBounds || null;

  const alignedNir = resampleNearest(nir.values, nir.width, nir.height, targetWidth, targetHeight);
  const alignedSecond = resampleNearest(second.values, second.width, second.height, targetWidth, targetHeight);
  bandStore.set("NIR", {
    values: alignedNir,
    width: targetWidth,
    height: targetHeight,
    geoBounds: nir.geoBounds || second.geoBounds || null
  });
  bandStore.set(secondRole, {
    values: alignedSecond,
    width: targetWidth,
    height: targetHeight,
    geoBounds: second.geoBounds || nir.geoBounds || null
  });
  return true;
}

function updateBandUploadStatus() {
  const secondRole = getSecondaryRoleKey();
  const hasNir = bandStore.has("NIR");
  const hasSecond = bandStore.has(secondRole);
  if (hasNir && hasSecond) {
    const n = bandStore.get("NIR");
    setStatus(`Ready: NIR + ${secondRole} loaded (${n.width} x ${n.height}).`, 2);
    return;
  }
  if (!hasNir && !hasSecond) {
    setStatus("Waiting for required band uploads.", 2);
    return;
  }
  if (!hasNir) {
    setStatus("Upload the NIR band to continue.", 2);
    return;
  }
  setStatus(`Upload the ${secondRole} band to continue.`, 2);
}

async function handleRoleBandUpload(file, roleKey) {
  if (!file) return;
  try {
    const payload = await readSingleBandFile(file, roleKey);
    bandStore.set(roleKey, payload);
    alignRoleBandsForCompute();
    renderPreview();
    indexCtx.clearRect(0, 0, indexCanvas.width, indexCanvas.height);
    newIndexCyclePending = true;
    updateBandUploadStatus();
    updateWorkflowProgress();
  } catch (err) {
    console.error(err);
    setStatus(`Could not read ${roleKey} band: ${err.message}`, 2);
  }
}

initMap();
setOverlayOpacityFromInput();
setCompareBlendFromInput();
updateStep3ModeUi();
updateBlendControlVisibility();
updateClearVectorButtonVisibility();
updateBandUploadStatus();

if (overlayOpacityInput) {
  overlayOpacityInput.addEventListener("change", setOverlayOpacityFromInput);
}
if (indexTypeSelect) {
  indexTypeSelect.addEventListener("change", () => {
    const nextSecondaryRole = getSecondaryRoleKey();
    if (nextSecondaryRole === "RED") {
      bandStore.delete("SWIR2");
    } else {
      bandStore.delete("RED");
    }
    if (secondaryBandFileInput) secondaryBandFileInput.value = "";
    alignRoleBandsForCompute();
    updateStep3ModeUi();
    step1Confirmed = false;
    setStatus(`Selected ${getCurrentIndexType().toUpperCase()}. Press OK in Step 1.`, 1);
    updateBandUploadStatus();
    updateWorkflowProgress();
  });
}
if (step1OkBtn) {
  step1OkBtn.addEventListener("click", confirmStep1Selection);
}
if (nirBandFileInput) {
  nirBandFileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    handleRoleBandUpload(file, "NIR");
  });
}
if (secondaryBandFileInput) {
  secondaryBandFileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    handleRoleBandUpload(file, getSecondaryRoleKey());
  });
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

window.addEventListener("beforeunload", () => {
  snapshotStore.forEach((snap) => {
    if (snap && typeof snap.imageUrl === "string" && snap.imageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(snap.imageUrl);
    }
  });
});

computeBtn.addEventListener("click", () => {
  computeIndex().catch((err) => {
    setStatus(`Index computation failed: ${err.message}`, 3);
    if (computeBtn) computeBtn.disabled = false;
  });
});
updateWorkflowProgress();
