const OC_URL = Cypress.env('OC_URL')

// TODO move types to another fixture
describe('a', () => {
  it('b', () => {
    cy.fixture(`deployments/simple-blueprint-gcp1.json`).then(deployment => {
      const {DeploymentTemplate, DeploymentPath, ResourceTemplate, ResourceType} = deployment
      const dt = Object.values(DeploymentTemplate)[0]
      const primary = ResourceTemplate[dt.primary]
      console.log(primary)
      const env = Object.values(DeploymentPath)[0].environment
      cy.visit(`${OC_URL}/${dt.projectPath}`)

      cy.get(`[data-testid="deploy-template-${dt.source}"]`).click()

      cy.get('[data-testid="deployment-name-input"]').clear().type(`Cypress ${dt.title}`)
      cy.get('[data-testid="deployment-environment-select"]').click()
      cy.get(`[data-testid="deployment-environment-selection-${env}"]`).click()

      cy.contains('button', 'Next').click()


      cy.get('[data-testid^="delete-or-disconnect"]').each(el => {
        el.click()
        cy.contains('button.js-modal-action-primary', 'Remove').click()
      })



      // primary
      for(const property of primary.properties) {
        cy.get(`input[data-testid="oc-input-${primary.name}-${property.name}"]`).type(property.value)
      }

      for(const dependency of primary.dependencies) {
        if(!dependency.match) continue
        cy.get(`[data-testid="create-dependency-${primary.name}.${dependency.name}"]`).click()
        const constraintType = ResourceType[dependency.constraint.resourceType]
        console.log(constraintType)
        cy.get(`[data-testid="resource-selection-${dependency.constraint.resourceType}"]`).click()
        cy.get('[data-testid="create-resource-template-title"]').clear().type(ResourceTemplate[dependency.match].title)
        cy.contains('button', 'Next').click()
        //cy.contains('button.js-modal-action-primary', 'Remove').click()
      }
    })
  })
})
