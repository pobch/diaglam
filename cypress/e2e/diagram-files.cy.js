import { TextReader, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js'
import {
  dragCanvas, exportDrawing, imageFile, installSavePicker, uploadImage,
} from '../e2e-helpers/diagramFiles'
import { createAllElements } from '../e2e-helpers/setupForSelection'

function openImportMenu() {
  cy.findByRole('button', { name: 'More' }).should('not.be.disabled').click()
  cy.findByRole('button', { name: 'Import' }).click()
}

function importDiagramBytes(contents, name = 'drawing.diaglam') {
  openImportMenu()
  cy.get('input[aria-label="Import diagram"]').selectFile({ contents, fileName: name }, { force: true })
  cy.findByRole('button', { name: 'More' }).should('not.be.disabled')
}

async function zipFixture(manifest, assets = {}) {
  const zip = new ZipWriter(new Uint8ArrayWriter(), { level: 0, useWebWorkers: false })
  await zip.add('diagram.json', new TextReader(manifest))
  for (const [id, { mimeType, bytes }] of Object.entries(assets)) {
    await zip.add(`assets/${id}.${mimeType.split('/')[1]}`, new Uint8ArrayReader(bytes))
  }
  return Cypress.Buffer.from(await zip.close())
}

function importDocument(document, name) {
  const assets = Object.fromEntries(Object.entries(document.assets).map(([id, { mimeType }]) => [
    id, { mimeType },
  ]))
  const manifest = JSON.stringify({ ...document, assets })
  cy.then(() => zipFixture(manifest, document.assets)).then((bytes) => importDiagramBytes(bytes, name))
}

const emptyDocument = { format: 'diaglam', version: 2, elements: [], assets: {} }
const pencil = { id: 1, type: 'pencil', points: [{ x: 150, y: 150 }, { x: 200, y: 200 }] }

it('toggles the file actions and dismisses them on outside clicks', () => {
  cy.visit('/')
  cy.findByRole('button', { name: 'More' }).click()
  cy.findByRole('button', { name: 'Import' }).should('be.visible')
  cy.findByRole('button', { name: 'Export' }).should('be.visible')
  cy.findByRole('button', { name: 'More' }).should('have.attr', 'aria-expanded', 'true').click()
  cy.findByRole('button', { name: 'More' }).should('have.attr', 'aria-expanded', 'false')
  cy.findByRole('button', { name: 'Import' }).should('not.exist')
  cy.findByRole('button', { name: 'More' }).click()
  cy.get('canvas').last().click(700, 400)
  cy.findByRole('button', { name: 'Export' }).should('not.exist')
  cy.viewport(320, 660)
  cy.findByRole('button', { name: 'More' }).click()
  cy.findByRole('button', { name: 'Import' }).should('be.visible')
  cy.findByRole('button', { name: 'Export' }).should('be.visible')
})

it('round trips every element type and stores duplicated images only once', () => {
  createAllElements()
  const saves = installSavePicker()
  cy.findByRole('img', { name: 'pencil' }).click()
  cy.get('canvas').last().trigger('pointerdown', { clientX: 550, clientY: 200, isPrimary: true })
  cy.get('canvas').last().trigger('pointermove', { clientX: 580, clientY: 220, isPrimary: true })
  cy.get('canvas').last().trigger('pointerup', { clientX: 580, clientY: 220, isPrimary: true })
  uploadImage()
  cy.get('#selection').should('be.checked')
  cy.get('canvas').last().trigger('pointerdown', { clientX: 115, clientY: 115, isPrimary: true })
  cy.get('canvas').last().trigger('pointerup', { clientX: 115, clientY: 115, isPrimary: true })
  cy.findByRole('img', { name: 'duplicate' }).click()
  exportDrawing(saves).then((document) => {
    expect(saves[0].options.suggestedName).to.equal('untitled.diaglam')
    expect(saves[0].options.types[0].accept['application/zip']).to.deep.equal(['.diaglam'])
    expect(document.format).to.equal('diaglam')
    expect(document.version).to.equal(2)
    expect(document.elements.map((element) => element.type)).to.include.members(['line', 'rectangle', 'text', 'arrow', 'pencil', 'image'])
    const images = document.elements.filter((element) => element.type === 'image')
    expect(images).to.have.length(2)
    expect(images[0].assetId).to.equal(images[1].assetId)
    expect(Object.keys(document.assets)).to.have.length(1)
    cy.findByRole('img', { name: 'clearCanvas' }).click()
    exportDrawing(saves).its('elements').should('have.length', 0)
    cy.window().then((win) => {
      cy.spy(win, 'createImageBitmap').as('decodeImportedImages')
    })
    cy.then(async () => Cypress.Buffer.from(await saves[0].blob.arrayBuffer())).then((bytes) => {
      expect(bytes.subarray(0, 4).toString('hex')).to.equal('504b0304')
      importDiagramBytes(bytes.subarray(0, 32))
      cy.findByRole('dialog').should('contain.text', 'valid Diaglam ZIP archive')
      cy.findByRole('button', { name: 'Close' }).click()
      const imageBytes = document.assets[images[0].assetId].bytes
      const offset = bytes.indexOf(imageBytes)
      expect(offset).to.be.greaterThan(0)
      const corrupted = Cypress.Buffer.from(bytes)
      corrupted[offset + imageBytes.length - 1] ^= 1
      importDiagramBytes(corrupted)
      cy.findByRole('dialog').should('contain.text', 'Invalid CRC32')
      cy.findByRole('button', { name: 'Close' }).click()
      importDiagramBytes(bytes, 'RESTORED.DIAGLAM')
    })
    cy.get('@decodeImportedImages').should('have.been.calledOnce')
    cy.compareSnapshot('restored-images', {
      clip: { x: 90, y: 90, width: 60, height: 100 },
    })
  })
})

it('rejects version 1 JSON files', () => {
  cy.visit('/')
  importDiagramBytes(Cypress.Buffer.from(JSON.stringify({ ...emptyDocument, version: 1 })))
  cy.findByRole('dialog').should('contain.text', 'valid Diaglam ZIP archive')
})

it('keeps only one undo step after import and preserves zoom and pan', () => {
  cy.visit('/')
  const saves = installSavePicker()
  importDocument({ ...emptyDocument, elements: [pencil] })
  cy.findByRole('img', { name: 'clearCanvas' }).click()
  cy.findByRole('img', { name: 'undo' }).click()
  cy.findByRole('img', { name: 'zoomIn' }).click()
  cy.findByRole('img', { name: 'hand' }).click()
  cy.get('canvas').last().trigger('pointerdown', { clientX: 500, clientY: 400, isPrimary: true })
  cy.get('canvas').last().trigger('pointermove', { clientX: 550, clientY: 430, isPrimary: true })
  cy.get('canvas').last().trigger('pointerup', { clientX: 550, clientY: 430, isPrimary: true })
  let canvasBefore
  cy.get('canvas').last().then(($canvas) => { canvasBefore = $canvas[0].toDataURL() })
  importDocument({ ...emptyDocument, elements: [pencil] })
  cy.get('canvas').last().should(($canvas) => expect($canvas[0].toDataURL()).to.equal(canvasBefore))
  exportDrawing(saves).its('elements').then((previousElements) => {
    importDocument(emptyDocument)
    exportDrawing(saves).its('elements').should('have.length', 0)
    cy.findByRole('img', { name: 'undo' }).click()
    exportDrawing(saves).its('elements').should('deep.equal', previousElements)
    cy.findByRole('img', { name: 'undo' }).click()
    exportDrawing(saves).its('elements').should('deep.equal', previousElements)
    cy.findByRole('img', { name: 'redo' }).click()
    exportDrawing(saves).its('elements').should('have.length', 0)
  })
})

it('does not change the drawing or history when any part of an import is invalid', () => {
  cy.visit('/')
  const saves = installSavePicker()
  importDocument({ ...emptyDocument, elements: [pencil] })
  for (const [document, name] of [
    [emptyDocument, 'wrong.json'],
    [{ ...emptyDocument, version: 3 }, 'wrong.diaglam'],
    [{ ...emptyDocument, elements: [pencil, { ...pencil }] }, 'wrong.diaglam'],
    [{ ...emptyDocument, elements: [{ ...pencil, type: 'unknown' }] }, 'wrong.diaglam'],
    [{ ...emptyDocument, elements: [{ id: 2, type: 'image', x1: 1, y1: 1, x2: 40, y2: 30, assetId: 'missing' }] }, 'wrong.diaglam'],
    [{ ...emptyDocument, elements: [pencil, { id: 2, type: 'text', isWriting: false, lines: [{}] }] }, 'wrong.diaglam'],
  ]) {
    importDocument(document, name)
    cy.findByRole('dialog').should('be.visible')
    cy.findByRole('button', { name: 'Close' }).click()
    exportDrawing(saves).its('elements').should('deep.equal', [pencil])
  }
  cy.then(() => zipFixture('{')).then((bytes) => importDiagramBytes(bytes))
  cy.findByRole('dialog').should('contain.text', 'valid JSON')
  cy.findByRole('button', { name: 'Close' }).click()
  cy.findByRole('img', { name: 'undo' }).click()
  exportDrawing(saves).its('elements').should('have.length', 0)
})

it('retains a bitmap for undo and redo, and closes it when its history is discarded', () => {
  cy.visit('/')
  let close
  cy.window().then(async (win) => {
    const decode = win.createImageBitmap.bind(win)
    cy.stub(win, 'createImageBitmap').callsFake(async (...args) => {
      const bitmap = await decode(...args)
      close = cy.spy(bitmap, 'close')
      return bitmap
    })
    return new Uint8Array(await (await imageFile(win)).arrayBuffer())
  }).then((bytes) => {
    cy.get('#image-upload').selectFile({ contents: Cypress.Buffer.from(bytes), fileName: 'red.png', mimeType: 'image/png' }, { force: true })
  })
  const saves = installSavePicker()
  exportDrawing(saves).its('elements').should('have.length', 1)
  cy.findByRole('img', { name: 'clearCanvas' }).click()
  cy.then(() => expect(close).not.to.have.been.called)
  cy.findByRole('img', { name: 'undo' }).click()
  exportDrawing(saves).its('elements').should('have.length', 1)
  cy.findByRole('img', { name: 'undo' }).click()
  cy.then(() => expect(close).not.to.have.been.called)
  importDocument(emptyDocument)
  cy.then(() => expect(close).to.have.been.calledOnce)
})

it('offers a filename fallback and handles native save cancellation and failure', () => {
  cy.visit('/')
  cy.window().then((win) => { win.showSaveFilePicker = undefined })
  cy.findByRole('button', { name: 'More' }).click()
  cy.findByRole('button', { name: 'Export' }).click()
  cy.findByRole('dialog', { name: 'Export diagram' }).should('be.visible')
  cy.findByRole('textbox', { name: 'File name' }).should('have.value', 'untitled.diaglam').clear()
  cy.findByRole('textbox', { name: 'File name' }).type('my diagram')
  cy.window().then((win) => {
    cy.stub(win.HTMLAnchorElement.prototype, 'click').callsFake(function () {
      expect(this.download).to.equal('my diagram.diaglam')
    }).as('download')
  })
  cy.findByRole('button', { name: 'Save' }).click()
  cy.get('@download').should('have.been.calledOnce')
  cy.findByRole('dialog').should('not.exist')
  cy.window().then((win) => {
    win.showSaveFilePicker = async () => { throw new win.DOMException('Cancelled', 'AbortError') }
  })
  cy.findByRole('button', { name: 'More' }).click()
  cy.findByRole('button', { name: 'Export' }).click()
  cy.findByRole('button', { name: 'More' }).should('not.be.disabled')
  cy.findByRole('dialog').should('not.exist')
  cy.window().then((win) => {
    const abort = cy.stub().resolves()
    win.showSaveFilePicker = async () => ({ createWritable: async () => ({
      write: async () => { throw new win.Error('Cannot write the file.') },
      close: cy.stub().resolves(),
      abort,
    }) })
    cy.wrap(abort).as('abortSave')
  })
  cy.findByRole('button', { name: 'More' }).click()
  cy.findByRole('button', { name: 'Export' }).click()
  cy.findByRole('dialog').should('contain.text', 'Cannot write the file.')
  cy.get('@abortSave').should('have.been.calledOnce')
  cy.findByRole('button', { name: 'Close' }).click()
})

it('rejects invalid image data and drawing operations without changing the drawing', () => {
  cy.visit('/')
  const saves = installSavePicker()
  let oversizedBytes
  cy.window().then(async (win) => {
    const file = await imageFile(win, 1501, 100)
    return Cypress.Buffer.from(await file.arrayBuffer())
  }).then((bytes) => { oversizedBytes = bytes })
  uploadImage()
  cy.findByRole('img', { name: 'rectangle' }).click()
  dragCanvas({ x: 300, y: 200 }, { x: 400, y: 300 })
  exportDrawing(saves).then((document) => {
    const image = document.elements.find((element) => element.type === 'image')
    const assetId = image.assetId
    const invalidImage = Cypress._.cloneDeep(document)
    invalidImage.assets[assetId].bytes = Cypress.Buffer.from('bad image data')
    const wrongType = Cypress._.cloneDeep(document)
    wrongType.assets[assetId].mimeType = 'image/jpeg'
    const oversizedImage = Cypress._.cloneDeep(document)
    oversizedImage.assets[assetId].bytes = oversizedBytes
    const invalidPrecision = Cypress._.cloneDeep(document)
    invalidPrecision.elements.find((element) => element.type === 'rectangle')
      .roughElements[0].options.fixedDecimalPlaceDigits = 101
    const invalidOperation = Cypress._.cloneDeep(document)
    invalidOperation.elements.find((element) => element.type === 'rectangle')
      .roughElements[0].sets[0].ops[0].data = [1]
    for (const invalid of [invalidImage, wrongType, oversizedImage, invalidPrecision, invalidOperation]) {
      importDocument(invalid)
      cy.findByRole('dialog').should('be.visible')
      cy.findByRole('button', { name: 'Close' }).click()
      exportDrawing(saves).should('deep.equal', document)
    }

    // Observe browser resource cleanup while the import itself uses the UI.
    const closedBitmaps = []
    cy.window().then((win) => {
      const decode = win.createImageBitmap.bind(win)
      cy.stub(win, 'createImageBitmap').callsFake(async (...args) => {
        const bitmap = await decode(...args)
        closedBitmaps.push(cy.spy(bitmap, 'close'))
        return bitmap
      })
    })
    const partialImport = Cypress._.cloneDeep(document)
    partialImport.elements.push({ ...image, id: 0, assetId: 'image-2' })
    partialImport.assets['image-2'] = { mimeType: 'image/png', bytes: Cypress.Buffer.from('bad image data') }
    importDocument(partialImport)
    cy.findByRole('dialog').should('be.visible')
    cy.then(() => {
      expect(closedBitmaps).to.have.length(1)
      expect(closedBitmaps[0].callCount).to.equal(1)
    })
    cy.findByRole('button', { name: 'Close' }).click()
    exportDrawing(saves).should('deep.equal', document)
  })
})
