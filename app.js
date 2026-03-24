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

let currentSessionId = null;
let currentBands = [];

function setStatus(text) {
  statusLine.textContent = text;
}

function renderBandList(bands, width, height) {
  bandList.innerHTML = "";
  bands.forEach((band) => {
    const li = document.createElement("li");
    li.textContent = `${band}: ${width} x ${height}`;
    bandList.appendChild(li);
  });
}

function renderBandSelectors(bands) {
  currentBands = bands;
  bandA.innerHTML = "";
  bandB.innerHTML = "";
  bands.forEach((name) => {
    const o1 = document.createElement("option");
    o1.value = name;
    o1.textContent = name;
    bandA.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = name;
    o2.textContent = name;
    bandB.appendChild(o2);
  });

  if (bands.includes("NIR")) bandA.value = "NIR";
  if (bands.includes("RED")) bandB.value = "RED";
  if (bandB.value === bandA.value && bands.length > 1) bandB.value = bands[1];
}

function drawBase64PngToCanvas(base64Data, canvas, ctx) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve();
    };
    img.onerror = reject;
    img.src = `data:image/png;base64,${base64Data}`;
  });
}

async function uploadBands(files) {
  const form = new FormData();
  for (let i = 0; i < files.length; i += 1) {
    form.append("files", files[i]);
  }

  const response = await fetch("/api/upload", {
    method: "POST",
    body: form
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Upload failed.");

  currentSessionId = data.session_id;
  renderBandList(data.bands, data.width, data.height);
  renderBandSelectors(data.bands);
  await drawBase64PngToCanvas(data.preview_png_base64, previewCanvas, previewCtx);
  indexCtx.clearRect(0, 0, indexCanvas.width, indexCanvas.height);
  setStatus(data.status);
}

async function computeIndex() {
  if (!currentSessionId) {
    setStatus("Upload bands first.");
    return;
  }
  if (!currentBands.includes(bandA.value) || !currentBands.includes(bandB.value)) {
    setStatus("Choose valid Band A and Band B.");
    return;
  }

  const payload = {
    session_id: currentSessionId,
    label: indexLabel.value.trim() || "Custom Index",
    formula: formulaType.value,
    band_a: bandA.value,
    band_b: bandB.value
  };

  const response = await fetch("/api/compute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Compute failed.");

  await drawBase64PngToCanvas(data.index_png_base64, indexCanvas, indexCtx);
  setStatus(data.status);
}

fileInput.addEventListener("change", async (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  setStatus("Uploading bands to Python backend...");
  try {
    await uploadBands(files);
  } catch (error) {
    setStatus(error.message || "Upload failed.");
    console.error(error);
  }
});

computeBtn.addEventListener("click", async () => {
  setStatus("Computing index on Python backend...");
  try {
    await computeIndex();
  } catch (error) {
    setStatus(error.message || "Compute failed.");
    console.error(error);
  }
});
