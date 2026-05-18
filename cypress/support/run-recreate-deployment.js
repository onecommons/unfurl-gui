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

console.log('[trace-load] run-recreate-deployment.js loaded')
Cypress.Commands.add('recreateDeployment', options => {
  console.log('[trace-cmd] recreateDeployment entry')
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

    // The Next click triggers a route change to /deployment-drafts/...; without
    // this small wait the immediately-following cy.get(card-*).should('exist')
    // can fire against the *prior* page's DOM (the wizard hasn't mounted yet)
    // and cypress's retry loop fails with the misleading "expected null to exist"
    // instead of the usual "Timed out... never found it". Once the wizard mounts,
    // card-the_app is present and the rest of recreateTemplate can proceed.
    cy.wait(2000)
    cy.get('[data-testid^="card-"]').should('exist')

    if(BLUEPRINT_REVISION) {
      cy.url().then(url => cy.visit(`${url}&bprev=${BLUEPRINT_REVISION}`))
      cy.get('[data-testid^="card-"]').should('exist')
    }

    function recreateTemplate(template, variant = 0) {
      cy.task('writeArtifact', {artifactName: `trace-rt-${template?.name}-${variant}.log`, data: `recreateTemplate name=${template?.name} variant=${variant}\n`}, {log: false})
      cy.assertNoErrors()
      if(variant != HIDDEN) {
        cy.task('log', `[trace] check card-${template.name} exists`, {log: false})
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
              let q = `
                [data-testid="oc-input-${template.name}-${property.name}"].el-input,
                [data-testid="oc-input-${template.name}-${property.name}"].el-input-number
              `
              let qChecked = `label[data-testid="oc-input-${template.name}-${property.name}"].el-checkbox`
              let el
              if($document2.querySelector(q)) {
                cy.get(`[data-testid="oc-input-${template.name}-${property.name}"]`)
                  .last()
                  .invoke('val', '')
                  .type(value)
              } else if (el = $document2.querySelector(qChecked)) {
                if(el.classList.contains('is-checked') && !value) {
                  cy.get(qChecked).click()
                } else if(!el.classList.contains('is-checked') && value) {
                  cy.get(qChecked).click()
                }
              } else {
                cy.log(`Could not find ${property.name} on ${template.name}`)
                cy.log(`Used selector ${q}`)
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

    cy.task('log', `[trace] entering recreateTemplate primary=${primary?.name}`, {log: false})
    recreateTemplate(primary, PRIMARY)
    cy.task('log', `[trace] returned from recreateTemplate primary`, {log: false})

    cy.assertNoErrors()
    cy.task('log', `[trace] post-recreate assertNoErrors passed`, {log: false})

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
        // Same race as after the Next click earlier: deploy triggers a route
        // change to /-/deployments/..., and a `should()` chain fired against
        // a mid-navigation cy.url() yields a null subject and a misleading
        // chai error. A small explicit wait lets the URL settle.
        cy.wait(2000)
        cy.url({timeout: BASE_TIMEOUT * 10}).should('not.include', 'deployment-drafts')
        cy.wait(BASE_TIMEOUT)
        // TODO figure out how to chain this?


        cy.withStore((store) => {
          cy.task('log', `[trace] inside withStore, checking deployment`, {log: false})
          const deployment = store.getters.getDeployment
          cy.task('log', `[trace] deployment=${deployment ? deployment.name : String(deployment)}`, {log: false})
          expect(deployment).to.exist
          const deploymentDir = store.getters.lookupDeployPath(deployment.name, deployment._environment)?.name
          cy.task('log', `[trace] deploymentDir=${deploymentDir}`, {log: false})
          expect(deploymentDir).to.exist

          cy.execLoud(`./testing-shared/run-unfurl.sh deploy --dryrun --use-environment ${deployment._environment} --approve --jobexitcode error ${deploymentDir}`, {
            timeout: BASE_TIMEOUT * 100,  // unfurl isn't known to hang, so we can wait a long time
            failOnNonZeroExit: false // we'll fail later when we check the status - this is better for the log
          })
        })
        // The deploy CLI writes lastJob to ensemble.yaml on disk but doesn't
        // git-commit, so the rust proxy's commit-keyed cache stays valid and
        // the next /export returns the pre-deploy snapshot (status: null).
        // POST clear_project_file_cache so cy.reload() forces a fresh export.
        // Pull the project path from window.gon.home_project (same value the
        // SPA uses for its own export calls).
        cy.window().then(win => {
          const projectPath = win.gon && win.gon.home_project
          if (projectPath) {
            cy.task('log', `[trace] clearing cache for ${projectPath}`, {log: false})
            cy.request('POST', `${OC_URL}/services/unfurl-server/clear_project_file_cache?auth_project=${encodeURIComponent(projectPath)}`)
          } else {
            cy.task('log', `[trace] no home_project on gon; skipping cache clear`, {log: false})
          }
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

