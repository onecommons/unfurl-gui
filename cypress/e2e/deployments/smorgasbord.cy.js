import slugify from '../../../packages/oc-pages/vue_shared/slugify'
const GCP_ENVIRONMENT_NAME = Cypress.env('GCP_ENVIRONMENT_NAME')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')

// only for subsequent tests with the environment we create
const USE_UNFURL_DNS = Cypress.env('USE_UNFURL_DNS')

function propertySort(a, b) {
  return a.name.localeCompare(b.name)
}

describe('Smorgasbord blueprint test', () => {
  const suffix = Date.now().toString(36).slice(4) + Math.random().toString().slice(-4)
  const deploymentTitle = `Smorgasbord ${suffix}`
  const env = GCP_ENVIRONMENT_NAME

  const projectPath = `/${REPOS_NAMESPACE}/smorgasbord`

  before(() => {
    cy.whenEnvironmentAbsent(env, () => {
      cy.createGCPEnvironment({
        environmentName: env,
        shouldCreateExternalResource: true,
        shouldCreateDNS: !USE_UNFURL_DNS,
      })
    })
  })


  it('Can fill out the deployment', () => {
    cy.visit(projectPath)

    cy.get('[data-testid="deploy-template-gcp"]').click()

    cy.get('[data-testid="deployment-name-input"]')
      .invoke('val', '')
      .type(deploymentTitle)


    cy.contains('button', 'Next').click()


    function fillInputs(prefix='', suffix=':visible') {
      cy.get(`${prefix}[data-testid="oc-input-the_app-text"]${suffix} input`).type('hello world')
      cy.get(`${prefix}[data-testid="oc-input-the_app-number"]${suffix} input`).type('12')
      cy.get(`${prefix}[data-testid="oc-input-the_app-checkbox"]${suffix} input`).check({force: true})
      cy.contains(`${prefix}button${suffix}`, 'Generate').click()
      cy.get(`${prefix}[data-testid="oc-input-the_app-textarea"]${suffix} textarea`).type('hello world')
    }
    cy.get('[data-testid="oc-inputs-the_app"]').within(() => {
      fillInputs()
    })

    cy.get('[data-testid="oc-input-the_app-object_inputs"]').click()

    fillInputs('.el-popover ')

    cy.get('input:first').blur({ force: true })

    cy.wait(1000)

    cy.withStore().then(store => {
      const currentState = JSON.parse(
        JSON.stringify(store.state.templateResources.resourceTemplates)
      )

      currentState.the_app.properties.sort(propertySort)

      const pw = currentState.the_app.properties.find(p => p.name == 'password')

      if(pw?.value) {
        pw.value = {get_env: `${slugify(deploymentTitle)}__the_app__password`.replace(/-/, '_')}
      }

      const oiPw = currentState.the_app.properties.find(p => p.name == 'object_inputs')

      if(oiPw?.value?.password) {
        oiPw.value.password = { get_env: `${slugify(deploymentTitle)}__the_app__object_inputs_password`.replace(/-/, '_') }
      }

      cy.get('[data-testid="save-draft-btn"]').click()

      cy.contains('.gl-alert-body', 'Draft saved!').should('be.visible')
      cy.get('[data-testid^="card-"]').should('exist')

      cy.withStore().then(store => {
        const newState = JSON.parse(
          JSON.stringify(store.state.templateResources.resourceTemplates)
        )

        newState.the_app.properties.sort(propertySort)

        // FIXME these don't match because generate is blown away from the value
        // value vs default
        // expect(currentState.the_app.properties.find(p => p.name == 'text'))
        //   .to.deep.equal(newState.the_app.properties.find(p => p.name == 'text'))

        expect(currentState).to.deep.equal(newState)
      })
    })
  })
})
