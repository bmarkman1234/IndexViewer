# IndexViewer

IndexViewer is a lightweight browser app for calculating and comparing remote sensing indices from raster bands.

## What You Can Do

- Upload raster bands (`.tif`, `.tiff`, `.png`, `.jpg`, `.jpeg`)
- Assign and confirm aliases for each band
- Build index formulas using aliases directly (no curly braces required)
- Save multiple calculated indices for comparison
- Compare saved indices on a map overlay
- Click map pixels to view per-index pixel values and trend
- Export pixel values to CSV

## Step-By-Step Instructions

### 1) Open the App

1. Open `index.html` in your browser.
2. Confirm the left panel shows the 4-step Workflow.

### 2) Step 1: Upload Bands

1. In **Step 1: Upload Bands**, choose one or more band files.
2. Wait for the status message to confirm files are loaded.
3. The app automatically resamples inputs to a common working size if needed.

Notes:
- GeoTIFF files can include map bounds for overlay placement.
- If bounds are missing, index will still compute but map georeference may be unavailable.

### 3) Step 2: Review Bands (Required)

1. Review the band list and dimensions.
2. Set an alias for each band in the alias editor (for example `B4`, `B5`, `NIR`, `RED`).
3. Confirm each alias by editing the field (Step 2 completes only after aliases are explicitly set/confirmed).

Tips:
- Keep alias names short and formula-friendly.
- Avoid duplicate alias names.

### 4) Step 3: Calculate Index

1. Enter an **Index label** (this is what gets saved in compare lists and CSV).
2. Enter your formula in **Index Formula**.
3. Use the **Formula Help** dropdown for:
   - alias mapping
   - helper functions (`abs`, `sqrt`, `pow`, `min`, `max`, `log`, `exp`, `sin`, `cos`, `tan`)
   - constants (`PI`, `E`)
   - [IndexDatabase](https://www.indexdatabase.de/) reference
4. Click **Calculate Index**.

Formula syntax:
- Use aliases directly: `NIR - RED`
- Or use raw names in brackets: `[LC09_..._B5.TIF]`
- Curly braces are optional for aliases.

### 5) Step 4: Save And Compare

1. Each calculation is saved automatically using its **Index label**.
2. Use **Saved indices** dropdown to pick any saved index.
3. Click **Show Selected Index** to display it.
4. Click **Delete Selected Index** to remove accidental calculations.
5. Use **New Index** (next to Workflow header) to start a fresh calculation cycle without deleting previously saved indices.

### 6) Map Overlay Controls

Inside the map panel (top-right floating controls):

1. Set **Overlay opacity** from the dropdown.
2. Set **Change slider** from the dropdown.

Notes:
- These controls affect visualization only.
- Pixel sampling is based on saved index data, not visual blend.

### 7) Pixel Value Panel

1. Click any location on the map.
2. The panel lists a pixel value for each saved index label.
3. A trend chart shows value changes across saved indices.

### 8) Export CSV

1. In **Pixel Value** panel, click **CSV**.
2. The export includes:
   - `snapshot_id`
   - `index_label`
   - `lat`
   - `lon`
   - `pixel_x`
   - `pixel_y`
   - `pixel_value`
   - `status` (`ok` or `outside_extent`)

## Workflow Status Colors

- **Pending**: Red
- **In Progress**: Yellow
- **Complete**: Green

## Troubleshooting

- **Step 2 not completing:** make sure each alias field was explicitly edited/confirmed.
- **Formula error:** verify alias names match exactly and raw band references use `[exact name]`.
- **Map overlay missing:** source may not contain valid georeferencing metadata.
- **No pixel values:** click the map first and ensure at least one index has been saved.
