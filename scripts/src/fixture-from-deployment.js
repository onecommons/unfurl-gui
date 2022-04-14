#!/usr/bin/env node

const path = require('path')
const {unfurlGuiRoot} = require('./shared/util.js')
const args = process.argv.slice(2)
const fs = require('fs')

const pathComponents = args[0].split(path.sep)
pathComponents.pop()
const
  deploymentName = pathComponents.pop(),
  blueprintName = pathComponents.pop()

let environmentName
while(pathComponents.length && pathComponents[pathComponents.length - 1] != 'environments') {
  environmentName = pathComponents.pop()
}
pathComponents.pop()

const dashboardDir = path.join(...pathComponents)

const 
  fixtureName = `_${environmentName}__${blueprintName}__${deploymentName}`,
  fixturePath = `generated/deployments/${fixtureName}`

const testTemplate = fs.readFileSync(
  path.join(__dirname, 'fixture-from-deployment', 'recreate-deployment.template.js'),
  'utf-8'
)
  .replace('$FIXTURE_PATH', fixturePath)
  .replace('$TEST_NAME', fixtureName)

const environmentsJSON = fs.readFileSync(
  path.join(dashboardDir, 'environments.json'),
  'utf-8'
)
const {DeploymentPath} = JSON.parse(environmentsJSON)

Object.keys(DeploymentPath).forEach(key => {
  if(!key.startsWith(`environments/${environmentName}`) || !key.endsWith(`${blueprintName}/${deploymentName}`)) {
    delete DeploymentPath[key]
  }
})

switch(Object.keys(DeploymentPath).length) {
  case 0:
    throw new Error('No deployment records found in environments.json')
  case 1:
    break
  default:
    throw new Error('Conflicting deployment records found in environments.json')
}

let deploymentJSON = fs.readFileSync(
  args[0],
  'utf-8'
)

deploymentJSON = JSON.parse(deploymentJSON)

deploymentJSON.DeploymentPath = DeploymentPath

fs.writeFileSync(
  path.join(unfurlGuiRoot, 'cypress/fixtures', `${fixturePath}.json`),
  JSON.stringify(deploymentJSON)
)

fs.writeFileSync(
  path.join(unfurlGuiRoot, 'cypress/integration/generated', `${fixtureName}.js`),
  testTemplate
)
