import {deploymentFixturePath} from '../../support/deployment-fixture'
describe('_production-gcp__nextcloud__redis-mail-pg', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment(deploymentFixturePath('gcp__nextcloud__full_sh'))
  })
})
