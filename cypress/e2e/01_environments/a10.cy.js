const NAMESPACE = Cypress.env('DEFAULT_NAMESPACE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const USERNAME = Cypress.env('OC_IMPERSONATE')

describe('importing a10', () => {
  before(() => {
    cy.visit('/dashboard/projects')
    cy.document().then(doc => {
      if(doc.querySelector(`a[href="/${USERNAME}/a10dashboard"]`)) return

      cy.visit('/projects/new')

      cy.get('[data-qa-panel-name="import_project"]').click()

      cy.get('[data-qa-selector="gitlab_import_button"]').click()

      cy.get('[data-qa-selector="project_name_field"]').type("a10dashboard")

      cy.contains('.form-group', 'GitLab project export').within(() => {
        // cy.get('input[type="file"]').attachFile({
        //   encoding: 'utf-8',
        //   filePath: '2023-08-21_18-53-632_a10_dashboard_export.tar.gz',
        //   mimeType: 'application/gzip',
        //   lastModified: new Date().getTime(),
        //   force: true
        // })
        cy.get('input[type="file"]').selectFile({
          contents: 'cypress/fixtures/2023-08-21_18-53-632_a10_dashboard_export.tar.gz',
          mimeType: 'application/gzip',
        })
      })

      // cy.wait(BASE_TIMEOUT * 100)
      cy.get('[data-qa-selector="import_project_button"]').click()

      cy.contains('No repository').should('not.exist')
      cy.contains('The repository could not be imported.', {timeout: BASE_TIMEOUT * 3}).should('not.exist')
      cy.contains('Import in progress', {timeout: BASE_TIMEOUT * 3}).should('not.exist')

    })
  })

  it('Can visit dashboard', () => {
    cy.visit(`/${USERNAME}/a10dashboard`)
    cy.get('.gl-spinner', {timeout: BASE_TIMEOUT * 3}).should('not.exist')
    cy.contains('No repository').should('not.exist')
    cy.contains('404').should('not.exist')

    cy.get('#content-body').within(() => {
      cy.contains('a', 'a10dashboard').should('exist') // breadcrumbs
      cy.contains('a', 'k8snow').should('exist')
      cy.contains('a', 'unfurl-server').should('exist')
      cy.contains('README.md').should('exist')
    })
  })
})
