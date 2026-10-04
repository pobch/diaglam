import { defineConfig } from 'cypress'
import { configureVisualRegression } from 'cypress-visual-regression'

export default defineConfig({
  viewportWidth: 1000,
  viewportHeight: 660,
  screenshotsFolder: 'cypress/snapshots/actual',
  trashAssetsBeforeRuns: true,
  video: false,
  expose: {
    visualRegressionType: 'regression',
    visualRegressionBaseDirectory: 'cypress/snapshots/base',
    visualRegressionDiffDirectory: 'cypress/snapshots/diff',
    visualRegressionGenerateDiff: 'fail',
    visualRegressionFailSilently: false,
    visualRegressionUpdateSnapshots: false,
  },
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    setupNodeEvents(on) {
      configureVisualRegression(on)
    },
  },
})
