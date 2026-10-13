it('should be able to create a rectangle', () => {
  cy.visit('/')

  cy.findByRole('img', { name: 'rectangle' }).click()
  cy.get('#root')
    .trigger('pointerdown', {
      clientX: 100,
      clientY: 100,
      isPrimary: true,
    })
  cy.get('#root')
    .trigger('pointermove', {
      clientX: 200,
      clientY: 300,
      isPrimary: true,
    })
  cy.get('#root')
    .trigger('pointerup', {
      clientX: 200,
      clientY: 300,
      isPrimary: true,
    })
  cy.get('#root')
    .trigger('pointermove', {
      clientX: 250,
      clientY: 350,
      isPrimary: true,
    })

  cy.compareSnapshot('happy-path-rectangle')
})
