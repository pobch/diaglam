const pencil = (x) => ({ type: 'pencil', points: [{ x, y: 0 }] })
const addPencil = (history, x) =>
  history.commitNewSnapshot({
    mode: 'addElements',
    newElementWithoutIds: [pencil(x)],
  })[0]

beforeEach(() => {
  cy.visit('/cypress/fixtures/history.html')
  cy.window().should('have.property', 'historyTest')
})

it('assigns fresh, increasing IDs to imported and new elements before a render', () => {
  let previousId
  cy.window().then((win) => {
    const history = win.historyTest
    previousId = addPencil(history, -1)
    history.loadSnapshot([
      { ...pencil(0), id: previousId },
      { ...pencil(1), id: Number.MAX_SAFE_INTEGER },
    ])
    addPencil(history, 2)
    const second = addPencil(history, 3)
    history.undo()
    history.redo()
    history.replaceCurrentSnapshotByModifyingElements([{ ...pencil(4), id: second }])
  })
  cy.window().should((win) => {
    const snapshot = win.historyTest.currentSnapshot
    expect(snapshot.map((element) => element.points[0].x)).to.deep.equal([0, 1, 2, 4])
    const ids = snapshot.map((element) => element.id)
    expect(ids[0]).to.be.greaterThan(previousId)
    expect(ids[1]).to.be.lessThan(Number.MAX_SAFE_INTEGER)
    expect(ids).to.deep.equal([...new Set(ids)].sort((a, b) => a - b))
  })
})

it('closes an image only after its last history reference is removed', () => {
  const first = { bitmap: { close: cy.stub() } }
  const second = { bitmap: { close: cy.stub() } }
  const image = (data) => ({ type: 'image', x1: 0, y1: 0, x2: 10, y2: 10, data })
  let id
  cy.window().then((win) => {
    const history = win.historyTest
    id = history.commitNewSnapshot({ mode: 'addElements', newElementWithoutIds: [image(first)] })[0]
    // Replacing an uncommitted image drops its only reference.
    history.replaceCurrentSnapshotByModifyingElements([{ ...image(second), id }])
    expect(first.bitmap.close.callCount).to.equal(1)
    history.commitNewSnapshot({ mode: 'clone' })
    history.replaceCurrentSnapshotByModifyingElements([{ ...image(second), id, x1: 5 }])
    history.replaceCurrentSnapshotByRemovingElement(id)
    history.undo()
    history.redo()
    expect(second.bitmap.close.callCount).to.equal(0)
    // The load drops older entries, but the incoming elements still use the bitmap.
    history.loadSnapshot([
      { ...image(second), id },
      { ...image(second), id: id + 1 },
    ])
    expect(second.bitmap.close.callCount).to.equal(0)
    history.undo()
    history.commitNewSnapshot({ mode: 'clone' })
    expect(second.bitmap.close.callCount).to.equal(1)
  })
  cy.window().should((win) => {
    expect(win.historyTest.currentSnapshot).to.deep.equal([])
    expect(first.bitmap.close.callCount).to.equal(1)
    expect(second.bitmap.close.callCount).to.equal(1)
  })
})
