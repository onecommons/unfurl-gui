const GITHUB_USERNAME = Cypress.env('GITHUB_USERNAME') || 'onecommons-dummy-220819'

describe('_aws-2022-08-18t23-03-03__container-webapp5__container-webapp', () => {
  it('Can recreate deployment', () => {
    cy.enterGithubToken()
    cy.recreateDeployment({
        fixture: 'generated/deployments/_aws-2022-08-18t23-03-03__container-webapp5__container-webapp',
        afterRecreateDeployment() {
          cy.contains('.el-input-group__prepend', 'Github Project').next().type(`${GITHUB_USERNAME}/buildpack-test-app`)
          cy.contains('button', 'Import').click({force: true})
          cy.contains('a', 'Container').click()
          cy.contains('.formily-element-form-item-label', 'environment').next().within(() => {
            cy.contains('button', 'Add').click()
            cy.get('input[placeholder="key"]').type('PORT')
            cy.get('input[placeholder="value"]').type('5000')
          })
          cy.contains('.formily-element-form-item-label', 'ports').next().within(() => {
            cy.contains('button', 'Add').click()
            cy.get('input.el-input__inner').type('5000:5000')
          })
        }
    })
  })
})
