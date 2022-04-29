const OC_URL = Cypress.env('OC_URL')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const AWS_ENVIRONMENT_NAME = Cypress.env('AWS_ENVIRONMENT_NAME')
const PRIMARY = 1
const HIDDEN = 2

Cypress.Commands.add('recreateDeployment', fixture => {
  cy.document().then($document => {
    cy.fixture(fixture).then(deployment => {
      const {DeploymentTemplate, DeploymentPath, ResourceTemplate} = deployment
      const dt = Object.values(DeploymentTemplate)[0]
      const primary = ResourceTemplate[dt.primary]
      let env = Object.values(DeploymentPath)[0].environment
      if(AWS_ENVIRONMENT_NAME && dt.cloud == 'unfurl.relationships.ConnectsTo.AWSAccount') {
        env = AWS_ENVIRONMENT_NAME
      }
      let projectPath  = dt.projectPath
      if(REPOS_NAMESPACE) {
        projectPath = projectPath.split('/')
        projectPath[0] = REPOS_NAMESPACE
        projectPath = projectPath.join('/')
      }

      cy.visit(`${OC_URL}/${projectPath}`)

      cy.get(`[data-testid="deploy-template-${dt.source}"]`).click()

      cy.get('[data-testid="deployment-name-input"]').invoke('val', '')
      cy.wait(500)
      cy.get('[data-testid="deployment-name-input"]').type(`Cypress ${dt.title}`)
      cy.get('[data-testid="deployment-environment-select"]').click()
      cy.get(`[data-testid="deployment-environment-selection-${env}"]`).click()

      cy.contains('button', 'Next').click()


      function recreateTemplate(template, variant=0) {

        if(variant != HIDDEN) {
          if(variant != PRIMARY) {
            cy.get(`[data-testid=tab-inputs-${template.name}]`).click()
          }
          for(const property of template.properties) {
            cy.get(`[data-testid="oc-input-${template.name}-${property.name}"]`).last().type(property.value)
          }
        }

        for(const dependency of template.dependencies) {
          if(!dependency.match) continue

          const match = ResourceTemplate[dependency.match]

          if(dependency.constraint.visibility == 'hidden') {
            recreateTemplate(match, HIDDEN)
            continue
          }

          cy.get(`[data-testid^=tab-requirements-]`).last().click() // this is a bit hacky

          cy.get(`[data-testid="create-dependency-${template.name}.${dependency.name}"]`).click()
          cy.get(`[data-testid="resource-selection-${match.type}"]`).click()
          cy.get('[data-testid="create-resource-template-title"]').invoke('val', '').type(match.title)
          cy.contains('button', 'Next').click()
          if(!$document.querySelector(`[data-testid="card-${match.name}"]`)) {
            recreateTemplate(match)
          }
        }

      }

      recreateTemplate(primary, PRIMARY)

      // formily oninput bug
      cy.get('input:first').blur({ force: true })
      cy.wait(100)

      cy.get('[data-testid="deploy-button"]').click()
      cy.url().should('not.include', 'deployment-drafts', {timeout: 20000})

    })
  })
})
