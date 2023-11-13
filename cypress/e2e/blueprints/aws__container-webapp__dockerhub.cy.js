import {deploymentFixturePath} from '../../support/deployment-fixture'

const SPEC = 'aws__container-webapp__dockerhub'
describe(, () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment()
  })
})

describe(SPEC, () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment({
      fixture: deploymentFixturePath(SPEC),
      verificationRoutine: 'default',
      afterRecreateDeployment() {
        cy.contains('a', 'Container').click()
        cy.contains('.formily-element-form-item-label', 'ports').next().within(() => {
          cy.contains('button', 'Add').click()
          cy.get('input.el-input__inner').type('8080:80')
        })

        cy.get('input[data-testid="oc-input-the_app-image"]').type('nginx:latest')

        cy.wait(500)
      }
    })
  })
})
