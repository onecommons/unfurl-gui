import {dashboardPath} from '../../support/dashboard-path'

const ENVIRONMENT_NAME = 'env-test-' + 'repeated-save'

/*
 * Saving an environment twice used to lose what the first save wrote.
 *
 * deployment-resources commits, then emits saveTemplate, and the page's handler
 * rebuilds the base state the *next* save diffs against. That rebuild read
 * `this.environment` -- the snapshot freshState took when the page loaded -- so
 * a resource added since was absent from the new base, and the following save
 * diffed it away. A full document reload hid it by re-reading everything.
 *
 * One save does not show this, which is why the other environment specs did
 * not: the base state is only wrong for the save that comes after.
 */
describe('Saving an environment twice', () => {
  beforeEach(() => {
    cy.whenEnvironmentExists(ENVIRONMENT_NAME, () => {
      cy.deleteEnvironment(ENVIRONMENT_NAME)
    })
    cy.environmentShouldNotExist(ENVIRONMENT_NAME)
  })

  it('keeps the resource the first save wrote', () => {
    // creates the environment, adds the mail resource and saves it
    cy.createGenericEnvironment({
      environmentName: ENVIRONMENT_NAME,
      shouldCreateExternalResource: true,
    })

    // a second resource, and with it a second save
    cy.createDigitalOceanDNSInstance(ENVIRONMENT_NAME)

    // reload from the server: this has to assert what persisted, not what the
    // page still holds
    cy.visit(dashboardPath(`/-/environments/${ENVIRONMENT_NAME}`))
    cy.checkMail()
  })
})
