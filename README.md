# Diaglam

A diagram drawing application which is demonstrating how we can utilize `React.js` and HTML `<canvas/>` to create an interactive drawing.

## Application URL

https://draw.crispyscript.com (works best in desktop)

## Demo

https://user-images.githubusercontent.com/19894957/165162344-d48826a6-5169-4a2c-8403-6d4d94d4011f.mp4

## Feature Roadmap

- [x] Line drawing tool
- [x] Rectangle drawing tool
- [x] Pencil drawing tool(free-hand)
- [x] Selection tool for moving and resizing a single element
- [x] Undo/Redo/Clear
- [x] Text tool
- [x] Support deleting a selected element
- [x] Arrow drawing tool
  - https://stackoverflow.com/a/26806316
  - https://codesandbox.io/s/magical-feynman-mtuziv?file=/src/index.js
- [x] Pan
- [x] Zoom
- [x] CSS & Styling
- [x] Mobile & Resizing friendly
- [x] Multi-select elements
- [x] Support uploading an image
- [x] Duplicate elements
- [ ] Send to back/front
- [ ] Save the result to file / local storage (need to serialize the image)
- [ ] Limit max history stack to ~50 items
- [ ] Export canvas to png/jpeg
- [ ] Rotate
- [ ] Keyboard shortcut
- [ ] Setting stroke color
- [ ] Setting stroke width
- [ ] Filled rectangle
- [ ] Copy & Paste elements (upgrade "Duplicate" feature)

## Developer Notes

### Start the app locally

1. Run `yarn` to install all dependencies
2. Run `yarn start` to start the app locally

### Visual regression tests

The Cypress specs in `cypress/e2e` use `cypress-visual-regression` to compare screenshots.

Baselines are stored in `cypress/snapshots/base/` (the last known good state).

Actual are stored in `cypress/snapshots/actual/` (the result of the current test run).

Failed tests produce images in `cypress/snapshots/diff/` (the differences between the baseline and actual).

1. Start the app with `yarn start` and leave it running at `http://localhost:3000`.
2. In another terminal:

   ```bash
   # Compare the current app against the saved baselines.
   yarn visual:test
   ```

3. If the test fails, review the differences in `cypress/snapshots/diff/`
4. If the changes are intentional, update the baselines. Pass `--spec` to replace only the baselines produced by that specific `.cy.js` file:

   ```bash
   yarn visual:baseline --spec cypress/e2e/rectangle.cy.js
   # NPM equivalent:
   npm run visual:baseline -- --spec cypress/e2e/rectangle.cy.js
   ```

   This replaces all snapshots captured by tests in `rectangle.cy.js` and leaves baselines for other spec files unchanged. If a spec contains multiple tests and you want to replace the snapshots for just one test, temporarily change that test's `it(...)` to `it.only(...)`, run the command above for its spec, then remove `.only` before committing.

To test an app running at a different URL or test a single `.cy.js` file, pass `--config baseUrl=<url>` and/or `--spec <file>`:

```bash
yarn visual:test --config baseUrl=http://localhost:3001 --spec cypress/e2e/rectangle.cy.js
```

To replace **ALL** baselines after reviewing an intentional change:

```bash
# WARNING: We will lose all previous baselines!!
yarn visual:baseline
```

To open Cypress for interactive debugging (defaults to regression mode):

```bash
yarn cypress:open
```

Note:

- Generate and compare baselines on the same OS and Cypress version to keep the rendering consistent.
- Regression mode fails on missing baselines or visual differences and does not update baselines.

### Temporary functions for export/import diagram

The following functions are temporary. Mostly use for debugging. In the future, we will implement a proper export/import feature.

- `exportSnapshot()` to export the diagram (must not have any image element)
- `importSnapshot(value)` to import, `value` is the result of calling `exportSnapshot()` (must not have any image element)

### Icons

https://phosphoricons.com/

### Naming Confusion

- Most of x, y value are in `scene` coordinate (i.e. canvas coord, not viewport coord). They are inconsistency in naming. For example,
  ```js
  // All of these variable names are in `scene` coord
  let sceneX, x1, x2, pointerX
  ```
- However, the `viewport` coordinate is more consistency in naming.
  ```js
  // There always be `viewport` keyword in `viewport` coord
  let viewportX
  ```
