# IndexViewer

A lightweight web app for calculating and comparing raster indices. https://bmarkman1234.github.io/IndexViewer/

## Free Satellite Data Sources

- [USGS EarthExplorer](https://earthexplorer.usgs.gov/)
- [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/)

## Workflow Steps

### Step 1: Upload Bands

1. Open the app in your browser.
2. Upload one or more raster band files (`.tif`/`.tiff`).

### Step 2: Assign Band Aliases

1. Rename each uploaded band with a short alias (example: `B4`, `B5`).
2. Click **OK** in the Review Bands section after aliases are set.

### Step 3: Create Index

1. Enter an **Index name**.
2. Enter an index formula using aliases (example: `(B5 - B4) / (B5 + B4)`).
3. Click **Calculate Index And Show On Map**.

### Step 4: Save And Compare

1. Use the saved index controls to switch between calculated indices.
2. Click **New Index** to start another calculation while keeping previous saved results.

### Step 5: Pixel Value And CSV

1. Click the map to sample pixel values for available indices.
2. Export CSV from the Pixel Value panel.

## Formula Notes

- Use alias names directly (example: `B5 - B4`).
- You can also use raw names in brackets: `[file_name.tif]`.
- Helpers: `abs`, `sqrt`, `pow`, `min`, `max`, `log`, `exp`, `sin`, `cos`, `tan`
- Constants: `PI`, `E`

## CSV Fields

`index_name`, `lat`, `lon`, `pixel_x`, `pixel_y`, `pixel_value`, `status`
