import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('aws__mediawiki__mariadb', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('aws__mediawiki__mariadb'))
  })
})
