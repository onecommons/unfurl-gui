import './recreate-deployment-helpers'
import slugify from '../../packages/oc-pages/vue_shared/slugify'
const OC_URL = Cypress.env('OC_URL')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const K8S_ENVIRONMENT_NAME = Cypress.env('K8S_ENVIRONMENT_NAME')
const DO_ENVIRONMENT_NAME = Cypress.env('DO_ENVIRONMENT_NAME')
const AZ_ENVIRONMENT_NAME = Cypress.env('AZ_ENVIRONMENT_NAME')
const AWS_ENVIRONMENT_NAME = Cypress.env('AWS_ENVIRONMENT_NAME')
const AWS_DNS_ZONE = Cypress.env('AWS_DNS_ZONE')
const GCP_ENVIRONMENT_NAME = Cypress.env('GCP_ENVIRONMENT_NAME')
const GCP_DNS_ZONE = Cypress.env('GCP_DNS_ZONE')
const BLUEPRINT_REVISION = Cypress.env('BLUEPRINT_REVISION')
const SIMPLE_BLUEPRINT = Cypress.env('SIMPLE_BLUEPRINT')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const GENERATE_SUBDOMAINS = Cypress.env('GENERATE_SUBDOMAINS')
const USE_UNFURL_DNS = Cypress.env('USE_UNFURL_DNS')
const USERNAME = Cypress.env('OC_IMPERSONATE')
const TEARDOWN = Cypress.env('TEARDOWN')
const CLEAR_CACHE = Cypress.env('CLEAR_CACHE')
const DRYRUN = Cypress.env('DRYRUN')
const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')
const PRIMARY = 1
const HIDDEN = 2

function pseudorandomPassword() {
  return (Math.sqrt(Math.random()) * 100000000).toString(36) + (Math.sqrt(Math.random()) * 100000000).toString(36)
}

Cypress.Commands.add('recreateDeployment', options => {
  cy.wait(5000)
  let fixture, shouldDeploy, shouldSave, title, skipTeardown, expectExisting, verificationRoutine, _env, _dnsZone, subdomain
  if (typeof options == 'string') {
    fixture = options
    shouldDeploy = true
  } else {
    fixture = options.fixture
    shouldSave = options.shouldSave ?? false
    shouldDeploy = options.shouldDeploy ?? !shouldSave
    skipTeardown = options.skipTeardown
    expectExisting = options.expectExisting || false
    subdomain = options.subdomain,
    // skip didn't seem to work here
    verificationRoutine = DRYRUN? 'skip': options.verificationRoutine

    _dnsZone = options.dnsZone
    _env = options.env
  }

  cy.fixture(fixture).then(deployment => {
    const {DefaultTemplate, DeploymentTemplate, DeploymentPath, ResourceTemplate, ResourceType} = deployment
    const dt = Object.values(DeploymentTemplate)[0]
    title = options.title || `Cy ${dt.title} ${Date.now().toString(36)}`
    dt.title = title
    dt.name = slugify(title)
    const primary = ResourceTemplate[dt.primary]

    for(const key in DefaultTemplate) {
      if(ResourceTemplate[key]) continue
      ResourceTemplate[key] = DefaultTemplate[key]
    }

    for(const key in dt.ResourceTemplate || []) {
      ResourceTemplate[key] = dt.ResourceTemplate[key]
    }


    let env = _env || Object.values(DeploymentPath)[0].environment
    let dnsZone = _dnsZone
    if(!_env) {
      const cloud = dt.cloud?.split('@')?.shift()
      if(AWS_ENVIRONMENT_NAME && cloud == 'unfurl.relationships.ConnectsTo.AWSAccount') {
        env = AWS_ENVIRONMENT_NAME
        dnsZone = AWS_DNS_ZONE
        cy.createAWSEnvironment({
          environmentName: env,
          shouldCreateExternalResource: true,
          shouldCreateDNS: !USE_UNFURL_DNS,
        })
      } else if (GCP_ENVIRONMENT_NAME && cloud == 'unfurl.relationships.ConnectsTo.GoogleCloudProject') {
        env = GCP_ENVIRONMENT_NAME
        dnsZone = GCP_DNS_ZONE
        cy.createGCPEnvironment({
          environmentName: env,
          shouldCreateExternalResource: true,
          shouldCreateDNS: !USE_UNFURL_DNS,
        })
      } else if (DO_ENVIRONMENT_NAME && cloud == 'ConnectsTo.DigitalOceanEnvironment') {
        env = DO_ENVIRONMENT_NAME
        dnsZone = AWS_DNS_ZONE // not a mistake
        cy.createDigitalOceanEnvironment({
          environmentName: env,
          shouldCreateExternalResource: true,
          shouldCreateDNS: !USE_UNFURL_DNS,
        })
      } else if(K8S_ENVIRONMENT_NAME && cloud == 'unfurl.relationships.ConnectsTo.K8sCluster') {
        env = K8S_ENVIRONMENT_NAME
        dnsZone = AWS_DNS_ZONE
        cy.createK8SEnvironment({
          environmentName: env,
          shouldCreateExternalResource: true,
          shouldCreateDNS: !USE_UNFURL_DNS,
        })
      } else if(AZ_ENVIRONMENT_NAME && cloud == 'ConnectsTo.AzureEnvironment') {
        env = AZ_ENVIRONMENT_NAME
        dnsZone = AWS_DNS_ZONE // not a mistake
        cy.createAzEnvironment({
          environmentName: env,
          shouldCreateExternalResource: true,
          shouldCreateDNS: !USE_UNFURL_DNS,
        })
      }
    }

    cy.assertNoErrors()

    if(USE_UNFURL_DNS) {
      dnsZone = `${USERNAME}.u.${USE_UNFURL_DNS}`
    }


    let projectPath = dt.projectPath
    if (REPOS_NAMESPACE) {
      projectPath = projectPath.split('/')
      projectPath = [REPOS_NAMESPACE, projectPath[projectPath.length - 1]]
      projectPath = projectPath.join('/')
    }

    if(CLEAR_CACHE) {
      cy.execLoud(`./scripts/src/clear-project-file-cache.js --project-path ${projectPath}`)
    }


    cy.visit(`${OC_URL}/${projectPath.replace('simple-blueprint', SIMPLE_BLUEPRINT)}`)

    cy.assertNoErrors()

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

    if(BLUEPRINT_REVISION) {
      cy.url().then(url => cy.visit(`${url}&bprev=${BLUEPRINT_REVISION}`))
      cy.get('[data-testid^="card-"]').should('exist')
    }

    function recreateTemplate(template, variant = 0) {
      cy.assertNoErrors()
      if(variant != HIDDEN) {
        cy.get(`[data-testid^="card-${template.name}"]`).should('exist')
      }
      let inputWait = 500 // we should wait longer for the first for async components
      cy.document().then($document => {
        if (variant != HIDDEN) {
          // if (variant != PRIMARY) {
            if($document.querySelector(`[data-testid="tab-inputs-${template.name}"]`)) {
              cy.get(`[data-testid="tab-inputs-${template.name}"]`).click()
            }
          // }
          for (const property of template.properties) {
            if(property.value == null) continue
            cy.get('.el-card__body > [class^="formily-element-form"]').should('exist')
            let value = property.value
            let name = property.name
            if(name == 'subdomain') {
              if(subdomain) {
                value = subdomain
              } else if(GENERATE_SUBDOMAINS) {
                value = subdomain = (Date.now()).toString(36) + pseudorandomPassword().slice(0, 4)
              }
            }
            else if(typeof value == 'object' && value) {
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

            cy.wait(inputWait)
            inputWait = 100

            cy.document().then($document2 => {
              // NOTE coupled tightly with element ui
              const testidEl = `[data-testid="oc-input-${template.name}-${property.name}"]`
              let qChecked = `label${testidEl}.el-checkbox`
              let el

              const elem = $document2.querySelector(testidEl)

              if (elem && elem.closest('.el-select')) {
                // Element is inside (or is) an el-select dropdown widget.
                // The inner input is readonly by design – open the dropdown and click the option.
                cy.get(testidEl).last().closest('.el-select').click()
                cy.get('.el-select-dropdown:visible')
                  .contains('.el-select-dropdown__item', String(value))
                  .click()
              } else if (elem && (elem.classList.contains('el-input') || elem.classList.contains('el-input-number'))) {
                const innerInput = elem.querySelector('input')
                if (innerInput && innerInput.readOnly) {
                  // field is rendered read-only by formily (e.g. x-read-only / const) – skip
                  cy.log(`Skipping readonly field ${property.name} on ${template.name}`)
                } else {
                  cy.get(testidEl)
                    .last()
                    .invoke('val', '')
                    .type(value)
                }
              } else if (el = $document2.querySelector(qChecked)) {
                if(el.classList.contains('is-checked') && !value) {
                  cy.get(qChecked).click()
                } else if(!el.classList.contains('is-checked') && value) {
                  cy.get(qChecked).click()
                }
              } else {
                cy.log(`Could not find ${property.name} on ${template.name}`)
                cy.log(`Used selector ${testidEl}`)
              }
            })
          }

        }

        if(template.dependencies.length == 0) {
          cy.log(`no dependencies for ${template.name}`)
        }
        for(const dependency of template.dependencies) {
          if (!dependency.match) continue

          cy.log(`looking at child '${dependency.match}'`)
          const match = ResourceTemplate[dependency.match] || dt.ResourceTemplate[dependency.match]
          // dockerhost missing for some reason with current export?
          //expect(match).to.exist

          if(!match) {
            cy.log(`I don't see any '${dependency.match}'`)
            continue
          }

          if (dependency.constraint.visibility == 'hidden' || match.visibility == 'hidden') {
            cy.log(`${match.name} is hidden`)
            recreateTemplate(match, HIDDEN)
            continue
          }

          cy.get(`[data-testid^=tab-requirements-]`)
            .each(el => el.click())
            // .last()
            // .click() // this is a bit hacky

          let createDependencyQs = [
            `[data-testid="create-dependency-${template.name}.${dependency.name}"]`,
            `[data-testid^="create-dependency-${template.title}-"][data-testid$=".${dependency.name}"]`,
            `[data-testid^="create-dependency-${template.name.slice(0,-9)}-"][data-testid$=".${dependency.name}"]`
          ]

          createDependencyQs = createDependencyQs.join(', ')

          let dependencyCreate = $document.querySelector(createDependencyQs)
          if(!dependencyCreate) {
            cy.log(`Couldn't find create for ${template.name}.${dependency.name}, using '${createDependencyQs}' pretending hidden`)
            recreateTemplate(match, HIDDEN)
            continue
          }
          if(
            dependencyCreate &&
            !dependencyCreate.offsetParent &&
            $document.querySelector(`[data-testid=tab-extras-${template.name}]`)
          ) {
            cy.get(`[data-testid=tab-extras-${template.name}]`)
              .each(el => el.click())
            // .click() // this is even worse
          }

          // todo: use test id instead of prev
          cy.get(createDependencyQs)
            .prev()
            .invoke('attr', 'disabled')
            .then((disabled) => {
              // if button is enabled, and the env is provided, connects it
              if (!disabled) {
                cy.get(createDependencyQs)
                  .prev()
                  .click()

                // special case for inconsistent ordering of Unfurl Cloud DNS
                if(USE_UNFURL_DNS) {
                  cy.get(`[data-testid^="resource-selection-"]`).first().click()
                } else {
                  cy.get(`[data-testid^="resource-selection-"]`).not(`[data-testid="resource-selection-dns-zone"]`).first().click()
                }

                cy.contains('button', 'Next').click()
              } else {
                cy.get(createDependencyQs).click()

                // cy.get(`[data-testid="resource-selection-${match.type}"]`).click()
                // cy.get('[data-testid="create-resource-template-title"]')
                //   .invoke('val', '')
                //   .type(match.title)
                // cy.wait(500)
                // TODO try to make cypress less flakey without this
                const t = match.type.split('@').shift()
                const selectionVariants = [
                  t,
                  t.split('.').pop(),
                ].map(v => `[data-testid="resource-selection-${v}"]`)
                .join(', ')
                cy.get(selectionVariants).click()
                cy.wait(500)
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

    cy.assertNoErrors()

    console.log(options)

    // hack for azure credentials
    if(env == AZ_ENVIRONMENT_NAME) {
      cy.get('[data-testid^="tab-credentials"]').each($el => {
        cy.wrap($el).click()
        cy.wait(200)
      })

      cy.get('[data-testid$="admin_password"]').each($el => {
        cy.wrap($el).type(pseudorandomPassword() + 'aA1')
        cy.wait(200)
      })
    }

    if(typeof options.afterRecreateDeployment == 'function') options.afterRecreateDeployment()
    if(typeof options.patchAssertions == 'function') {
      // not sure why pathame never matches
      // cy.intercept({method: 'POST', pathname: '**/create-ensemble'}, options.patchAssertions)
      cy.intercept({method: 'POST', times: 1}, options.patchAssertions)
    }

    // formily oninput bug
    cy.get('input:first').blur({ force: true })
    cy.wait(BASE_TIMEOUT / 50)

    if(shouldDeploy) {
      cy.whenUnfurlGUI(() => {
        cy.get('[data-testid="deploy-button"]:not([disabled])').click({force: true})
        cy.assertNoErrors()
        cy.url({timeout: BASE_TIMEOUT * 10}).should('not.include', 'deployment-drafts')
        cy.wait(BASE_TIMEOUT)
        // TODO figure out how to chain this?

        
        cy.withStore((store) => {
          const deployment = store.getters.getDeployment
          expect(deployment).to.exist
          const deploymentDir = store.getters.lookupDeployPath(deployment.name, deployment._environment)?.name
          expect(deploymentDir).to.exist

          cy.execLoud(`./testing-shared/run-unfurl.sh deploy --dryrun --use-environment ${deployment._environment} --approve --jobexitcode error ${deploymentDir}`, {
            timeout: BASE_TIMEOUT * 100,  // unfurl isn't known to hang, so we can wait a long time
            failOnNonZeroExit: false // we'll fail later when we check the status - this is better for the log
          })
        })

        cy.reload()
        cy.withStore((store) => {
          const deployment = store.getters.getDeployment
          expect(deployment.status).to.equal(1)
        })

      })
      cy.whenGitlab(() => {
        if(DRYRUN) {
          cy.get('[data-testid="deploy-button"]').next().click()
          // cy.get('[data-testid="toggle-dry-run"]').click() // covered by label
          cy.contains('label', 'Dry Run').click()
        }

        // cy.get('[data-testid="deploy-button"]:not([disabled])').click({position: 'bottomLeft'})
        // doesn't work reliably in CI
        // popover tooltip may partially cover when deplying DRYRUN
        cy.get('[data-testid="deploy-button"]:not([disabled])').click({force: true})

        cy.assertNoErrors()
        cy.url({timeout: BASE_TIMEOUT * 10}).should('include', dt.name)

        cy.wait(BASE_TIMEOUT)
        cy.withJob((job) => {
          cy.expectSuccessfulJob(job)
        })
        cy.assertDeploymentRunning(dt.title)
        if(!DRYRUN) {
          cy.verifyDeployment({deployment, env, dnsZone, sub: subdomain, expectExisting, verificationRoutine}, options.verificationArgs || {})
        }
        if(TEARDOWN && !skipTeardown && !DRYRUN) {
          cy.undeploy(dt.title)
        }
      })
    } else if(shouldSave) {
      cy.get('[data-testid="save-draft-btn"]').click()
      cy.wait(BASE_TIMEOUT / 2)
      cy.assertNoErrors()
    }
  })
})

