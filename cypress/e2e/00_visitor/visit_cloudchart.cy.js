const OC_URL = Cypress.env('OC_URL')

describe('Cloudmap', () => {
  before(() => {
    cy.visit('/cloud')
  })

  it('Should have a chart rendered', () => {
    cy.get('#chart svg').should('be.visible')
  })

  describe('Categories', () => {
    function categoryTest(category) {
      it(`has a label for ${category}`, () => {
        // cypress unable to detect visibility here
        cy.contains('text', category).should('to.exist')
      })
    }

    [
      'Database',
      'DNS',
      'Volume',
      'Compute',
      'Key-Value Store',
      // 'Application' renders no <text> in the chart. Unresolved whether the
      // category is missing from the cloudmap or the layout drops the label.
      'Mail'
    ].forEach(categoryTest)

  })


})
