const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const USERNAME = Cypress.env('OC_IMPERSONATE')

describe('importing a10', () => {
  before(() => {
    cy.requireProjectCreation()
    cy.visit('/dashboard/projects')
    cy.document().then(doc => {
      if(doc.querySelector(`a[href="/${USERNAME}/a10dashboard"]`)) return

      cy.visit('/projects/new')

      cy.get('[data-qa-panel-name="import_project"]').click()

      // GitLab 19 dropped data-qa-selector product-wide; these became testids
      // with hyphens (import/gitlab_projects/new.html.haml, _import_project_pane,
      // _new_project_fields). Both spellings while gdk-ee is still 15.11.
      cy.get('[data-testid="gitlab-import-button"], [data-qa-selector="gitlab_import_button"]').click()

      // `project-name-field`, from import/shared/_new_project_form.html.haml --
      // the import flow's own form. The create-from-scratch form uses
      // `project-name` for the same logical field, so grep the view that
      // actually renders rather than the first match.
      cy.get('[data-testid="project-name-field"], [data-qa-selector="project_name_field"]').type("a10dashboard")

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
      cy.get('[data-testid="import-project-button"], [data-qa-selector="import_project_button"]').click()

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
