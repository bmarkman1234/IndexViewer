# IndexViewer

A lightweight NDVI/NBR viewer for quick band-based index mapping, comparison, and pixel sampling. https://bmarkman1234.github.io/IndexViewer/

## Free Satellite Data Sources

- [USGS EarthExplorer](https://earthexplorer.usgs.gov/)
- [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/)

## Workflow Steps

### Step 1: Select Index

1. Open the app in your browser.
2. Choose `NDVI` or `NBR`.
3. (Optional) Enter an index name.
4. Click **OK**.

### Step 2: Upload Required Bands

1. Upload a `NIR` band.
2. Upload the second required band:
   - `Red` for NDVI
   - `SWIR2` for NBR

### Step 3: Create Index

1. Choose a color ramp.
2. Click **Calculate Index And Show On Map**.

Formulas used:
- NDVI: `(NIR - Red) / (NIR + Red)`
- NBR: `(NIR - SWIR2) / (NIR + SWIR2)`

### Step 4: Save And Compare

1. Use the saved index controls to switch between calculated indices.
2. Click **New Index** to start another calculation while keeping previous saved results.

### Step 5: Pixel Value And CSV

1. Click the map to sample pixel values for available indices.
2. Export CSV from the Pixel Value panel.
3. Optional: use the measure tool (bottom-left) and vector overlay upload (`.kml`, `.kmz`, `.zip` shapefile).

## CSV Fields

`index_name`, `lat`, `lon`, `pixel_x`, `pixel_y`, `pixel_value`, `status`
