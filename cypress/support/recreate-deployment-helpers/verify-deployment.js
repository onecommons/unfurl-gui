//import slugify from '../../../packages/oc-pages/vue_shared/slugify'
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const MOCK_DEPLOY = Cypress.env('MOCK_DEPLOY') || Cypress.env('UNFURL_MOCK_DEPLOY')

const TIMEOUT_SHORT = 40
const INTERVAL_SHORT = 4
const TIMEOUT_LONG = 80
const INTERVAL_LONG = 8

function _dt(deployment) {
  return Object.values(deployment.DeploymentTemplate)[0]
}

function _ab(deployment) {
  return Object.values(deployment.ApplicationBlueprint)[0]
}

function _primary(deployment) {
  return deployment.ResourceTemplate[_dt(deployment).primary]
}

const verificationRoutines = {
  minecraft({deployment, env, dnsZone, sub, cb}) {
    cy.contains('a', _dt(deployment).title).click()
    cy.withStore().its('getters.getCardsStacked.length').should('be.gt', 0)
    cy.withStore().then($store => {
      const compute = $store.getters.getCardsStacked[0]
      const address = compute.attributes.find(a => a.name == 'public_address').value
      const command = `./scripts/src/blueprint-validation/minecraft.js --host ${address} --port 25565`
      cb({command, timeout: BASE_TIMEOUT * TIMEOUT_SHORT, interval: BASE_TIMEOUT * INTERVAL_SHORT})
    })
  },
  mediawiki({deployment, env, dnsZone, sub, cb}) {
    const dt = _dt(deployment)
    const ab = _ab(deployment)
    const primary = _primary(deployment)
    const subdomain = sub || primary.properties.find(prop => prop.name == 'subdomain').value
    const command = `./scripts/src/blueprint-validation/no-http-error.js --base-url https://${subdomain}.${dnsZone}`
    cb({command, timeout: BASE_TIMEOUT * TIMEOUT_SHORT, interval: BASE_TIMEOUT * INTERVAL_SHORT})
  },

  nextcloud({deployment, env, dnsZone, sub, cb}) {
    const dt = _dt(deployment)
    const ab = _ab(deployment)
    const primary = _primary(deployment)
    const subdomain = sub || primary.properties.find(prop => prop.name == 'subdomain').value
    const username = 'jdenne'
    const password = env + '1'
    const command = `./scripts/src/blueprint-validation/nextcloud.js --base-url https://${subdomain}.${dnsZone} --register-name ${username} --register-password ${password}`
    cb({command, timeout: BASE_TIMEOUT * TIMEOUT_SHORT, interval: BASE_TIMEOUT * INTERVAL_SHORT})
  },

  wordpress({deployment, env, dnsZone, sub, cb}) {
    const dt = _dt(deployment)
    const ab = _ab(deployment)
    const primary = _primary(deployment)
    const subdomain = sub || primary.properties.find(prop => prop.name == 'subdomain').value
    const command = `./scripts/src/blueprint-validation/no-http-error.js --base-url https://${subdomain}.${dnsZone}`
    cb({command, timeout: BASE_TIMEOUT * TIMEOUT_SHORT, interval: BASE_TIMEOUT * INTERVAL_SHORT})
  },

  baserow({deployment, env, dnsZone, sub, cb}) {
    const dt = _dt(deployment)
    const ab = _ab(deployment)
    const primary = _primary(deployment)
    const phoneyUserEmail = `jdenne${Math.random().toString(36).slice(-4)}@${Cypress.env('SMTP_HOST')}`
    const password = env + '1'
    const subdomain = sub || primary.properties.find(prop => prop.name == 'subdomain').value
    const command = `./scripts/src/blueprint-validation/baserow.js --base-url https://${subdomain}.${dnsZone} --register-email ${phoneyUserEmail} --register-password ${password}`
    cb({command, timeout: BASE_TIMEOUT * TIMEOUT_LONG, interval: BASE_TIMEOUT * INTERVAL_LONG})
  },

  ghost({deployment, env, dnsZone, sub, cb}) {
    const dt = _dt(deployment)
    const ab = _ab(deployment)
    const primary = _primary(deployment)
    const email = Cypress.env('MAIL_USERNAME')
    const phoneyUserEmail = `jdenne${Math.random().toString(36).slice(-4)}@${Cypress.env('SMTP_HOST')}`
    const password = env + '1'
    const subdomain = sub || primary.properties.find(prop => prop.name == 'subdomain').value
    const command = `./scripts/src/blueprint-validation/ghost.js --base-url https://${subdomain}.${dnsZone} --admin-email ${email} --admin-password ${password} --register-email ${phoneyUserEmail} --register-name "John Denne"`
    cb({command, timeout: BASE_TIMEOUT * TIMEOUT_SHORT, interval: BASE_TIMEOUT * INTERVAL_SHORT})
  },

  'container-webapp': function({deployment, env, dnsZone, sub, cb}, {repository}) {
    const dt = _dt(deployment)
    const ab = _ab(deployment, cb)
    const primary = _primary(deployment)
    const subdomain = sub || primary.properties.find(prop => prop.name == 'subdomain').value

    const identifier = Date.now().toString(36)
    const command = `./scripts/src/blueprint-validation/container-webapp.js --live-url https://${subdomain}.${dnsZone} --repository ${repository} --identifier ${identifier}`
    cb({command, timeout: BASE_TIMEOUT * TIMEOUT_LONG, interval: BASE_TIMEOUT * INTERVAL_LONG})
  },

  'default': function({deployment, env, dnsZone, sub, cb}) {
    const primary = _primary(deployment)
    const subdomain = sub || primary.properties.find(prop => prop.name == 'subdomain').value
    const command = `./scripts/src/blueprint-validation/no-http-error.js --base-url https://${subdomain}.${dnsZone}`
    cb({command, timeout: BASE_TIMEOUT * TIMEOUT_LONG, interval: BASE_TIMEOUT * INTERVAL_LONG})
  },

  skip({cb}) {
    cb({command: '/bin/true', timeout: BASE_TIMEOUT * TIMEOUT_LONG, interval: BASE_TIMEOUT * INTERVAL_LONG})
  }
}

function verifyDeployment({deployment, env, dnsZone, sub, expectExisting, verificationRoutine}, verificationArgs) {
  console.log(deployment)
  if(MOCK_DEPLOY) return
  const ab = Object.values(deployment.ApplicationBlueprint)[0]
  const routine = verificationRoutines[verificationRoutine || ab.name] || verificationRoutines['default']

  function cb({timeout, interval, command}) {
    const _command = expectExisting? `${command} --expect-existing`: command
    cy.waitUntil(() => {
      cy.window().then(win => {
        typeof win.gc == 'function' && win.gc()
      })
      return cy.execLoud(
        _command,
        {failOnNonZeroExit: false, env: {FORCE_COLOR: 0}}
      ).then(result => {console.log(result); return result.code == 0})
    }, {timeout, interval})
  }
  routine({deployment, env, dnsZone, sub, cb}, verificationArgs)
}

Cypress.Commands.add('verifyDeployment', verifyDeployment)
