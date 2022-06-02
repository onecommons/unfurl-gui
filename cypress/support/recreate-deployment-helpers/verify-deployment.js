//import slugify from '../../../packages/oc-pages/vue_shared/slugify'
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')

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
  mediawiki(deployment, env) {
    const dt = _dt(deployment)
    const ab = _ab(deployment)
    const primary = _primary(deployment)
    const subdomain = primary.properties.find(prop => prop.name == 'subdomain').value
    const command = `./scripts/src/blueprint-validation/no-http-error.js --base-url https://${subdomain}.untrusted.me`
    console.log(command)
    cy.waitUntil(() => {
      return cy.exec(
        command, 
        {failOnNonZeroExit: false, env: {FORCE_COLOR: 0}}
      ).then(result => {console.log(result); return result.code == 0})
    }, {timeout: BASE_TIMEOUT * 10,  interval: BASE_TIMEOUT}) // baserow is slow to bootstrap
  },

  baserow(deployment, env) {
    const dt = _dt(deployment)
    const ab = _ab(deployment)
    const primary = _primary(deployment)
    const phoneyUserEmail = `jdenne${Math.random().toString(36).slice(-4)}@${Cypress.env('SMTP_HOST')}`
    const password = env + '1'
    const subdomain = primary.properties.find(prop => prop.name == 'subdomain').value
    const command = `./scripts/src/blueprint-validation/baserow.js --base-url https://${subdomain}.untrusted.me --register-email ${phoneyUserEmail} --register-password ${password}`
    console.log(command)
    cy.waitUntil(() => {
      return cy.exec(
        command, 
        {failOnNonZeroExit: false, env: {FORCE_COLOR: 0}}
      ).then(result => {console.log(result); return result.code == 0})
    }, {timeout: BASE_TIMEOUT * 60,  interval: BASE_TIMEOUT * 6}) // baserow is slow to bootstrap
  },

  ghost(deployment, env) {

    const dt = _dt(deployment)
    const ab = _ab(deployment)
    const primary = _primary(deployment)
    const email = Cypress.env('MAIL_USERNAME')
    const phoneyUserEmail = `jdenne${Math.random().toString(36).slice(-4)}@${Cypress.env('SMTP_HOST')}`
    const password = env + '1'
    const subdomain = primary.properties.find(prop => prop.name == 'subdomain').value
    const command = `./scripts/src/blueprint-validation/ghost.js --base-url https://${subdomain}.untrusted.me --admin-email ${email} --admin-password ${password} --register-email ${phoneyUserEmail} --register-name "John Denne"`
    console.log(command)
    cy.waitUntil(() => {
      return cy.exec(
        command, 
        {failOnNonZeroExit: false, env: {FORCE_COLOR: 0}}
      ).then(result => {console.log(result); return result.code == 0})
    }, {timeout: BASE_TIMEOUT * 10,  interval: BASE_TIMEOUT})
  }

}

function verifyDeployment(deployment, env) {
  console.log(deployment)
  const ab = Object.values(deployment.ApplicationBlueprint)[0] 
  const routine = verificationRoutines[ab.name]
  routine && routine(deployment, env)

}

Cypress.Commands.add('verifyDeployment', verifyDeployment)
