# Index Viewer

Browser-based satellite index viewer for uploading raster bands, computing custom indices, comparing snapshots over time, and probing pixel trends on an interactive map.

## Features

- Upload single-band or multi-band rasters (`.tif/.tiff/.png/.jpg`)
- Assign custom band aliases and use raster algebra formulas
- Save index snapshots over time and review changes
- Interactive map overlay with opacity and change slider
- Pixel probe (click map to inspect values and trend across snapshots)
- Export index image (`.png`)
- Export pixel probe timeline (`.csv`)

## Run Locally

This is a static app, so no build step is required.

1. Open the project folder.
2. Serve files over `http://localhost` (recommended) instead of opening `index.html` via `file://`.

Example with Python:

```bash
python -m http.server 8080
```

Then open:

`http://localhost:8080`

## Deploy on GitHub Pages

1. Create a new GitHub repository.
2. Push this project (including `index.html`, `app.js`, `styles.css`) to the `main` branch.
3. In GitHub, open the repository and go to:
   - `Settings` -> `Pages`
4. Under **Build and deployment**:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
5. Click **Save**.
6. Wait for deployment (usually 1-2 minutes), then open the published URL shown in the Pages settings.

## Usage Notes

- For formulas:
  - Use `{alias}` for renamed bands
  - Use `[raw file name]` for direct references
- Map overlay requires georeferenced raster bounds.
- OSM base map may rate-limit heavy usage; for production traffic, consider a dedicated tile provider.

