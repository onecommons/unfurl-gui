import './recreate-deployment-helpers'
import slugify from '../../packages/oc-pages/vue_shared/slugify'
const OC_URL = Cypress.env('OC_URL')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const AWS_ENVIRONMENT_NAME = Cypress.env('AWS_ENVIRONMENT_NAME')
const AWS_DNS_ZONE = Cypress.env('AWS_DNS_ZONE')
const GCP_ENVIRONMENT_NAME = Cypress.env('GCP_ENVIRONMENT_NAME')
const GCP_DNS_ZONE = Cypress.env('GCP_DNS_ZONE')
const SIMPLE_BLUEPRINT = Cypress.env('SIMPLE_BLUEPRINT')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const PRIMARY = 1
const HIDDEN = 2

function pseudorandomPassword() {
  return (Math.sqrt(Math.random()) * 100000000).toString(36) + (Math.sqrt(Math.random()) * 100000000).toString(36)
}

Cypress.Commands.add('recreateDeployment', options => {
  let fixture, shouldDeploy, shouldSave
  if (typeof options == 'string') {
    fixture = options
    shouldDeploy = true
  } else {
    fixture = options.fixture
    shouldSave = options.shouldSave ?? false
    shouldDeploy = options.shouldDeploy ?? !shouldSave
  }
  cy.fixture(fixture).then(deployment => {
    const {DefaultTemplate, DeploymentTemplate, DeploymentPath, ResourceTemplate} = deployment
    const dt = Object.values(DeploymentTemplate)[0]
    dt.title = `Cy ${dt.title} ${Date.now().toString(36)}`
    dt.name = slugify(dt.title)
    const primary = ResourceTemplate[dt.primary]

    for(const key in DefaultTemplate) {
      if(ResourceTemplate[key]) continue
      ResourceTemplate[key] = DefaultTemplate[key]
    }

    for(const key in dt.ResourceTemplate || []) {
      ResourceTemplate[key] = dt.ResourceTemplate[key]
    }


    let env = Object.values(DeploymentPath)[0].environment
    let dnsZone
    let ensureEnvExists = false
    if(AWS_ENVIRONMENT_NAME && dt.cloud == 'unfurl.relationships.ConnectsTo.AWSAccount') {
      env = AWS_ENVIRONMENT_NAME
      dnsZone = AWS_DNS_ZONE
      cy.whenEnvironmentAbsent(env, () => {
        cy.createAWSEnvironment({
          environmentName: env,
          shouldCreateExternalResource: true,
        })
      })
    } else if (GCP_ENVIRONMENT_NAME && dt.cloud == 'unfurl.relationships.ConnectsTo.GoogleCloudProject') {
      env = GCP_ENVIRONMENT_NAME
      dnsZone = GCP_DNS_ZONE
      cy.whenEnvironmentAbsent(env, () => {
        cy.createGCPEnvironment({
          environmentName: env,
          shouldCreateExternalResource: true,
        })
      })
    }

    let projectPath = dt.projectPath
    if (REPOS_NAMESPACE) {
      projectPath = projectPath.split('/')
      projectPath[0] = REPOS_NAMESPACE
      projectPath = projectPath.join('/')
    }

    cy.visit(`${OC_URL}/${projectPath.replace('simple-blueprint', SIMPLE_BLUEPRINT)}`)

    cy.get(`[data-testid="deploy-template-${dt.source}"]`)
    cy.wait(BASE_TIMEOUT / 2)
    cy.get(`[data-testid="deploy-template-${dt.source}"]`).click()

    // this thing is rediculous
    cy.get('[data-testid="deployment-name-input"]').focus()
    cy.get('[data-testid="deployment-name-input"]').invoke('val', '')
    cy.wait(500)
    // TODO try to make cypress less flakey without this
    cy.get('[data-testid="deployment-name-input"]').type(dt.title)
    cy.get('[data-testid="deployment-name-input"]').invoke('val', '')
    cy.wait(500)
    cy.get('[data-testid="deployment-name-input"]').type(dt.title)

    cy.get('[data-testid="deployment-environment-select"]').click()
    cy.get(`[data-testid="deployment-environment-selection-${env}"]`).click({force: true})

    cy.contains('button', 'Next').click()

    cy.get('[data-testid^="card-"]').should('exist')

    function recreateTemplate(template, variant = 0) {
      cy.document().then($document => {
        if (variant != HIDDEN) {
          if (variant != PRIMARY) {
            cy.get(`[data-testid=tab-inputs-${template.name}]`).click()
          }
          for (const property of template.properties) {
            let value = property.value
            if (typeof value == 'object' && value) {
              if (typeof value.get_env == 'string') {
                const envName = value.get_env.split('__').pop()
                const envValue = Cypress.env(value.get_env) || Cypress.env(envName)
                if(envValue) {
                  value = envValue
                } else if (envName.includes('password')) {
                  value = pseudorandomPassword()
                }
                else {
                  value = envName
                }
              }
            }
            // NOTE coupled tightly with element ui
            let q = `
              [data-testid="oc-input-${template.name}-${property.name}"].el-input,
              [data-testid="oc-input-${template.name}-${property.name}"].el-input-number
            `
            if($document.querySelector(q)) {
              cy.get(`[data-testid="oc-input-${template.name}-${property.name}"]`)
                .last()
                .invoke('val', '')
                .type(value)
            } else {
              console.log(`Could not find ${property.name} on ${template.name}`)
            }
          }

        }

        for(const dependency of template.dependencies) {
          if (!dependency.match) continue

          const match = ResourceTemplate[dependency.match]
          expect(match).to.exist

          if (dependency.constraint.visibility == 'hidden') {
            recreateTemplate(match, HIDDEN)
            continue
          }

          cy.get(`[data-testid^=tab-requirements-]`)
            .last()
            .click() // this is a bit hacky

          let dependencyCreate = $document.querySelector(`[data-testid="create-dependency-${template.name}.${dependency.name}"]`)
          if(!dependencyCreate) continue
          if(
            !dependencyCreate.offsetParent
            && $document.querySelector(`[data-testid=tab-extras-${template.name}]`)
          ) {
            cy.get(`[data-testid=tab-extras-${template.name}]`)
              .click() // this is even worse
          }

          // todo: use test id instead of prev
          cy.get(`[data-testid="create-dependency-${template.name}.${dependency.name}"]`)
            .prev()
            .invoke('attr', 'disabled')
            .then((disabled) => {
              // if button is enabled, and the env is provided, connects it 
              if (!disabled) {
                cy.get(`[data-testid="create-dependency-${template.name}.${dependency.name}"]`)
                  .prev()
                  .click()

                cy.get(`[data-testid^="resource-selection-"]`).click()

                cy.contains('button', 'Next').click()
              } else {
                cy.get(`[data-testid="create-dependency-${template.name}.${dependency.name}"]`).click()

                cy.get(`[data-testid="resource-selection-${match.type}"]`).click()
                cy.get('[data-testid="create-resource-template-title"]')
                  .invoke('val', '')
                  .type(match.title)
                cy.wait(500)
                // TODO try to make cypress less flakey without this
                cy.get(`[data-testid="resource-selection-${match.type}"]`).click()
                cy.get('[data-testid="create-resource-template-title"]')
                  .invoke('val', '')
                  .type(match.title)
                cy.contains('button', 'Next').click()
                if (!$document.querySelector(`[data-testid="card-${match.name}"]`)) {
                  recreateTemplate(match)
                }
              }
            })
        }
      })
    }

    recreateTemplate(primary, PRIMARY)

    // formily oninput bug
    cy.get('input:first').blur({ force: true })
    cy.wait(BASE_TIMEOUT / 50)

    if(shouldDeploy) {
      cy.get('[data-testid="deploy-button"]').click()
      cy.whenUnfurlGUI(() => {
        cy.url({timeout: BASE_TIMEOUT * 8}).should('not.include', 'deployment-drafts')
        cy.wait(BASE_TIMEOUT)
        // TODO figure out how to chain this?
        cy.withStore((store) => {
          expect(store.getters.getDeployment.status).to.equal(1)
        })

      })
      cy.whenGitlab(() => {
        cy.url({timeout: BASE_TIMEOUT * 4}).should('include', dt.name)
        cy.wait(BASE_TIMEOUT)
        cy.withJob((job) => {
          cy.expectSuccessfulJob(job)
        })
        cy.assertDeploymentRunning(dt.title)
        cy.verifyDeployment(deployment, env, dnsZone)
        cy.undeploy(dt.title)
      })
    } else if(shouldSave) {
      cy.get('[data-testid="save-draft-btn"]').click()
      cy.url().should('not.contain', 'deployment-drafts')
    }
  })
})
