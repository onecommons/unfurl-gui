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
  ghost(deployment, env) {

    const dt = _dt(deployment)
    const ab = _ab(deployment)
    const primary = _primary(deployment)
    const email = primary.properties.find(prop => prop.name == 'email').value
    const subdomain = primary.properties.find(prop => prop.name == 'subdomain').value

    //const env = Object.values(deployment.DeploymentPath)[0].environment
    const passwordEnvKey = (`${dt.name}__${dt.primary}__password`).replace(/-/g, '_')
    console.log(env, dt.name, dt.primary, passwordEnvKey)

  cy.withStore().then(store => {
    expect(store).to.exist
    const password = store.getters.lookupVariableByEnvironment(passwordEnvKey, env)
    const command = `./scripts/src/blueprint-validation/ghost.js --base-url https://${subdomain}.untrusted.me --username ${email} --password ${password}`
    console.log(command)
    cy.waitUntil(() => {
      return cy.exec(
        command, 
        {failOnNonZeroExit: false}
      ).then(result => {console.log(result); return result.code == 0})
    }, {timeout: BASE_TIMEOUT * 10,  interval: BASE_TIMEOUT})
  })
  }

}

function verifyDeployment(deployment, env) {
  console.log(deployment)
  const ab = Object.values(deployment.ApplicationBlueprint)[0] 
  const routine = verificationRoutines[ab.name]
  routine && routine(deployment, env)

}

Cypress.Commands.add('verifyDeployment', verifyDeployment)
