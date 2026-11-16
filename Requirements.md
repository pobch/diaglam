# Requirements

## Export and import diagrams

- Use the vertical three-dot **More** button in the footer. **Import** and **Export** open above it.
- Export saves the current drawing as `untitled.diaglam`. Change the name in the native Save dialog, or in the filename dialog on browsers without native file saving.
- `.diaglam` files contain JSON with `format: "diaglam"`, `version: <number>`, an `elements` array, and an `assets` object. Each image asset has a MIME type and base64 bytes. Multiple elements can reference one asset by `assetId`.
- Import accepts the extension case-insensitively. It validates all elements and images before changing the drawing. Unsupported versions and invalid files show an error modal. Use **Close** or the browser's built-in **Escape** behavior to dismiss it. Selecting the same invalid file again must show the error again.
- Import assigns fresh element IDs, replaces the drawing, and clears older history, except the latest one. One **Undo** restores the drawing from before the import; **Redo** restores the imported drawing. Zoom and pan levels do not change.

## Image tool

- Upload accepts PNG, JPEG, and WebP images up to 10 MiB (10,485,760 bytes). Images with a side larger than 2,000 pixels are reduced so that the longest side is 2,000 pixels, with the same aspect ratio, and stored as lossless PNG. Smaller images keep their original bytes.
- Canvas resizing does not resample image pixels. Snapshots and duplicated elements share each image's blob and bitmap. Base64 exists only during file processing. Decoded bitmaps are closed when no history entry needs them.

## History

```
history = [ snapshot_0, snapshot_1, ..., snapshot_n ]
snapshot_n = [ element_0, element_1, ..., element_m ]
```

- `element_m` can be a line, rectangle, text, image, etc.
- undo/redo moves the index of `history`
- some user actions do not create a new snapshot, but modify the last one. For example, moving an element, we do not want to create a new snapshot for every pixel of movement.
