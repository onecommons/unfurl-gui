import {deploymentFixturePath} from '../../support/deployment-fixture'

const SPEC = 'aws__container-webapp__container-webapp'

describe('nested tabs', () => {
  it('can maintain properties', () => {
    cy.recreateDeployment({
      fixture: deploymentFixturePath(SPEC),
      shouldSave: true,
      afterRecreateDeployment() {
        cy.contains('a', 'Container').click()

        cy.contains('a', 'Environment Variables').click()
        cy.contains('button:visible', 'Add').click()
        cy.getInputOrTextarea('[placeholder="key"]').type('PORT')
        cy.getInputOrTextarea('[placeholder="value"]').type('5000')

        cy.contains('a', 'Properties').click()
        cy.contains('.formily-element-form-item-label', 'ports').next().within(() => {
          cy.contains('button:visible', 'Add').click()
          cy.get('input.el-input__inner').type('5000:5000')
        })
      },
      patchAssertions(req) {
        const the_app = req.body.patch.find(p => p.name == 'the_app')
        const containerProp = the_app.properties.find(p => p.name == 'container')
        expect(containerProp.value).to.have.deep.property('ports', ['5000:5000'])
        expect(containerProp.value).to.have.deep.property('environment', {PORT: '5000'})
      }
    })
  })
})
