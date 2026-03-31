# IndexViewer

A lightweight tool for assessing regional change over time in vegetation health and fire damage 🛰️🌿. https://bmarkman1234.github.io/IndexViewer/

![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Markup-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-Styling-1572B6?logo=css3&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?logo=leaflet&logoColor=white)
![GeoTIFF.js](https://img.shields.io/badge/GeoTIFF.js-2.1.3-333333)
![Proj4js](https://img.shields.io/badge/Proj4js-2.11.0-333333)
![JSZip](https://img.shields.io/badge/JSZip-3.10.1-333333)
![toGeoJSON](https://img.shields.io/badge/toGeoJSON-5.8.1-333333)
![shpjs](https://img.shields.io/badge/shpjs-4.0.4-333333)
![OpenStreetMap](https://img.shields.io/badge/Basemap-OpenStreetMap-7EBC6F?logo=openstreetmap&logoColor=white)

## App Screenshot

![IndexViewer example screenshot](./Index_Viewer_Example.png)

## Free Satellite Data Sources

[![USGS EarthExplorer](https://img.shields.io/badge/USGS-EarthExplorer-005EA2)](https://earthexplorer.usgs.gov/)
[![Copernicus Data Space](https://img.shields.io/badge/Copernicus-Data%20Space%20Ecosystem-1F4E8C)](https://dataspace.copernicus.eu/)

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

1. If the Measure tool is on, click **Measure** to turn it off first.
2. Click the map to sample pixel values for available indices.
3. Export CSV from the Pixel Value panel.

### Measurement Tool

1. Use the **Measure** button in the bottom-left of the map to turn measuring on/off.
2. In measure mode, click map points to create a path and view total distance.
3. Click **Clear** to reset the measured path.
4. Turn measure mode off before selecting pixel values.

### Optional Overlay

1. Upload vector overlays (`.kml`, `.kmz`, `.zip` shapefile) to view reference boundaries.

## CSV Fields

`index_name`, `lat`, `lon`, `pixel_x`, `pixel_y`, `pixel_value`, `status`
