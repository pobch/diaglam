export async function imageFile(win, width = 40, height = 30, type = 'image/png') {
  const canvas = win.document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.fillStyle = '#ff0000'
  context.fillRect(0, 0, width, height)
  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, type)
  })
  return new win.File([blob], `image.${type.split('/')[1]}`, { type })
}

export function uploadImage(width = 40, height = 30, type = 'image/png') {
  // A successful upload switches the active tool to Selection.
  cy.findByRole('img', { name: 'hand' }).click()
  return cy
    .window()
    .then(async (win) => {
      const file = await imageFile(win, width, height, type)
      return {
        contents: Cypress.Buffer.from(await file.arrayBuffer()),
        fileName: file.name,
        mimeType: file.type,
      }
    })
    .then((file) => {
      cy.get('#image-upload').selectFile(file, { force: true })
      cy.get('#selection').should('be.checked')
      return cy.wrap(file.contents)
    })
}

export function dragCanvas(from, to) {
  cy.get('canvas')
    .last()
    .trigger('pointerdown', { clientX: from.x, clientY: from.y, isPrimary: true })
  cy.get('canvas')
    .last()
    .trigger('pointermove', {
      clientX: (from.x + to.x) / 2,
      clientY: (from.y + to.y) / 2,
      isPrimary: true,
    })
  cy.get('canvas').last().trigger('pointermove', { clientX: to.x, clientY: to.y, isPrimary: true })
  cy.get('canvas').last().trigger('pointerup', { clientX: to.x, clientY: to.y, isPrimary: true })
}

export function installSavePicker() {
  const saves = []
  cy.window().then((win) => {
    win.showSaveFilePicker = cy.stub().callsFake(async (options) => {
      const save = { options, blob: undefined, closed: false }
      saves.push(save)
      return {
        createWritable: async () => ({
          write: async (blob) => {
            save.blob = blob
          },
          close: async () => {
            save.closed = true
          },
        }),
      }
    })
  })
  return saves
}

export function exportDrawing(saves) {
  let previousCount
  cy.then(() => {
    previousCount = saves.length
  })
  cy.findByRole('button', { name: 'More' }).should('not.be.disabled').click()
  cy.findByRole('button', { name: 'Export' }).click()
  return cy
    .wrap(saves)
    .should((items) => {
      expect(items).to.have.length(previousCount + 1)
      expect(items.at(-1)?.closed).to.equal(true)
    })
    .then((items) => items.at(-1).blob.text())
    .then(JSON.parse)
}
