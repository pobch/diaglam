import { addCompareSnapshotCommand } from 'cypress-visual-regression/dist/command'

addCompareSnapshotCommand({
  capture: 'viewport',
  errorThreshold: 0,
})
