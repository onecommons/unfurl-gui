import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('gcp__mediawiki__mariadb', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('gcp__mediawiki__mariadb'))
  })
})
