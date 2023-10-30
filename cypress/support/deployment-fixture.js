const TEST_VERSIONS = Cypress.env('TEST_VERSIONS') || 'v2'

export function deploymentFixturePath(fixtureName) {
  return `generated/deployments/${TEST_VERSIONS}/${fixtureName}`
}


// Cypress.Commands.add('deploymentFixturePath', deploymentFixturePath)
