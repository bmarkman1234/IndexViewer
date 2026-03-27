# IndexViewer

A lightweight web app for calculating and comparing raster indices. https://bmarkman1234.github.io/IndexViewer/

## Quick Start

1. Open the site: [IndexViewer](https://bmarkman1234.github.io/IndexViewer/)
2. Upload raster bands.
3. In Workflow **Step 2**, set aliases for each band.
4. Enter **Index name** and formula.
5. Click **Calculate Index**.
6. Use **Saved indices** to compare results.
7. Click the map to view pixel values.
8. Export CSV from the Pixel Value panel.

## Formula Notes

- Use alias names directly (example: `B5 - B4`).
- You can also use raw names in brackets: `[file_name.tif]`.
- Helpers: `abs`, `sqrt`, `pow`, `min`, `max`, `log`, `exp`, `sin`, `cos`, `tan`
- Constants: `PI`, `E`

## CSV Fields

`index_name`, `lat`, `lon`, `pixel_x`, `pixel_y`, `pixel_value`, `status`
