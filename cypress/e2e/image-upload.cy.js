import { dragCanvas, exportDrawing, installSavePicker, uploadImage } from '../e2e-helpers/diagramFiles'

const uploadArea = { x: 90, y: 90, width: 60, height: 60 }

function exportedImageSize(document) {
  return cy.window().then(async (win) => {
    const image = document.elements.find((element) => element.type === 'image')
    const asset = document.assets[image.assetId]
    const blob = new win.Blob([Cypress.Buffer.from(asset.base64, 'base64')], { type: asset.mimeType })
    const bitmap = await win.createImageBitmap(blob)
    try {
      return { width: bitmap.width, height: bitmap.height }
    } finally {
      bitmap.close()
    }
  })
}

it('rejects images over 10 MiB and shows the error again after native dismissal or Close', () => {
  cy.visit('/')
  const oversizedFile = {
    contents: Cypress.Buffer.alloc(10 * 1024 * 1024 + 1), fileName: 'large.png', mimeType: 'image/png',
  }
  cy.get('#image-upload').selectFile(oversizedFile, { force: true })
  cy.findByRole('dialog').should('contain.text', '10,485,760 bytes')
  cy.findByRole('dialog').find('button').should('have.length', 1)
  cy.findByRole('button', { name: 'Close' }).should('have.focus')
  // A native close request follows the same cancel/close event path as Escape.
  cy.findByRole('dialog').then(($dialog) => { $dialog[0].requestClose() })
  cy.get('dialog').should('not.exist')
  cy.get('#image-upload').selectFile(oversizedFile, { force: true })
  cy.findByRole('dialog').should('be.visible').and('contain.text', '10,485,760 bytes')
  cy.get('dialog').click(-20, -20, { force: true })
  cy.findByRole('dialog').should('be.visible')
  cy.findByRole('button', { name: 'Close' }).click()
  cy.get('dialog').should('not.exist')
  cy.get('#image-upload').selectFile(oversizedFile, { force: true })
  cy.findByRole('dialog').should('be.visible').and('contain.text', '10,485,760 bytes')
  cy.findByRole('button', { name: 'Close' }).click()
  cy.get('dialog').should('not.exist')
  cy.get('#image-upload').selectFile({
    contents: Cypress.Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    fileName: 'pretend.png', mimeType: 'image/png',
  }, { force: true })
  cy.findByRole('dialog').should('contain.text', 'PNG, JPEG, or WebP')
})

for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
  it(`preserves original ${type} bytes through upload and export`, () => {
    cy.visit('/')
    const saves = installSavePicker()
    uploadImage(40, 30, type).then((originalBytes) => {
      cy.compareSnapshot(`uploaded-${type.split('/')[1]}`, { clip: uploadArea })
      exportDrawing(saves).then((document) => {
        const image = document.elements.find((element) => element.type === 'image')
        const asset = document.assets[image.assetId]
        expect(asset.mimeType).to.equal(type)
        expect(Cypress.Buffer.from(asset.base64, 'base64')).to.deep.equal(originalBytes)
        exportedImageSize(document).should('deep.equal', { width: 40, height: 30 })
      })
    })
  })
}

it('limits uploaded image resolution and keeps image bytes after moving and resizing', () => {
  cy.visit('/')
  const saves = installSavePicker()
  uploadImage(5000, 100)
  cy.compareSnapshot('uploaded-wide-image', { clip: uploadArea })
  let originalAssets
  exportDrawing(saves).then((document) => {
    originalAssets = document.assets
    exportedImageSize(document).should('deep.equal', { width: 2000, height: 40 })
  })
  dragCanvas({ x: 150, y: 120 }, { x: 170, y: 150 })
  exportDrawing(saves).then((document) => {
    expect(document.elements[0].x1).to.equal(120)
    expect(document.elements[0].y1).to.equal(130)
    expect(document.assets).to.deep.equal(originalAssets)
  })
  dragCanvas({ x: 120, y: 130 }, { x: 240, y: 150 })
  exportDrawing(saves).then((document) => {
    const image = document.elements[0]
    expect(image.x2 - image.x1).to.be.lessThan(2000)
    expect(document.assets).to.deep.equal(originalAssets)
    exportedImageSize(document).should('deep.equal', { width: 2000, height: 40 })
  })
  cy.findByRole('img', { name: 'undo' }).click()
  exportDrawing(saves).then((document) => {
    expect(document.elements[0].x2 - document.elements[0].x1).to.equal(2000)
    expect(document.assets).to.deep.equal(originalAssets)
  })
  cy.findByRole('img', { name: 'redo' }).click()
  exportDrawing(saves).then((document) => {
    expect(document.elements[0].x2 - document.elements[0].x1).to.be.lessThan(2000)
    expect(document.assets).to.deep.equal(originalAssets)
  })
})

it('limits uploaded image height and keeps the aspect ratio', () => {
  cy.visit('/')
  const saves = installSavePicker()
  uploadImage(100, 5000)
  cy.compareSnapshot('uploaded-tall-image', { clip: uploadArea })
  exportDrawing(saves).then((document) => {
    exportedImageSize(document).should('deep.equal', { width: 40, height: 2000 })
  })
})

it('closes only discarded redo images when a new action follows undo', () => {
  cy.visit('/')
  const closedBitmaps = []
  cy.window().then((win) => {
    const decode = win.createImageBitmap.bind(win)
    cy.stub(win, 'createImageBitmap').callsFake(async (...args) => {
      const bitmap = await decode(...args)
      closedBitmaps.push(cy.spy(bitmap, 'close'))
      return bitmap
    })
  })
  uploadImage()
  uploadImage()
  cy.wrap(closedBitmaps).should('have.length', 2)
  cy.findByRole('img', { name: 'undo' }).click()
  cy.then(() => {
    expect(closedBitmaps).to.have.length(2)
    closedBitmaps.forEach((close) => expect(close).not.to.have.been.called)
  })
  cy.findByRole('img', { name: 'clearCanvas' }).click()
  cy.then(() => {
    expect(closedBitmaps[0].callCount).to.equal(0)
    expect(closedBitmaps[1].callCount).to.equal(1)
  })
  cy.findByRole('img', { name: 'undo' }).click()
  cy.compareSnapshot('image-after-undo-clear', { clip: uploadArea })
  cy.findByRole('img', { name: 'redo' }).click()
  cy.then(() => {
    expect(closedBitmaps[0].callCount).to.equal(0)
    expect(closedBitmaps[1].callCount).to.equal(1)
  })
})

it('keeps new uploads and releases redo images when uploading or drawing after undo', () => {
  cy.visit('/')
  const closedBitmaps = []
  cy.window().then((win) => {
    const decode = win.createImageBitmap.bind(win)
    cy.stub(win, 'createImageBitmap').callsFake(async (...args) => {
      const bitmap = await decode(...args)
      closedBitmaps.push(cy.spy(bitmap, 'close'))
      return bitmap
    })
  })
  uploadImage()
  uploadImage()
  cy.wrap(closedBitmaps).should('have.length', 2)
  cy.findByRole('img', { name: 'undo' }).click()
  uploadImage()
  cy.wrap(closedBitmaps).should((bitmaps) => {
    expect(bitmaps).to.have.length(3)
    expect(bitmaps[0].callCount).to.equal(0)
    expect(bitmaps[1].callCount).to.equal(1)
    expect(bitmaps[2].callCount).to.equal(0)
  })
  cy.findByRole('img', { name: 'undo' }).click()
  cy.findByRole('img', { name: 'rectangle' }).click()
  dragCanvas({ x: 300, y: 200 }, { x: 400, y: 300 })
  cy.compareSnapshot('image-after-drawing', { clip: uploadArea })
  cy.then(() => {
    expect(closedBitmaps[0].callCount).to.equal(0)
    expect(closedBitmaps[1].callCount).to.equal(1)
    expect(closedBitmaps[2].callCount).to.equal(1)
  })
  cy.findByRole('img', { name: 'undo' }).click()
  cy.findByRole('img', { name: 'redo' }).click()
  cy.compareSnapshot('image-after-redo-drawing', { clip: uploadArea })
})
