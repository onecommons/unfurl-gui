#!/usr/bin/env node

const path = require('path')
const {unfurlGuiRoot} = require('./shared/util.js')
const fs = require('fs')
const args = require('minimist')(process.argv.slice(2))

const deploymentName = args.deployment || args['deployment-name']
const generateTest = args['test-name'] || args['test'] || args['generate-test']

const unfurlExport = JSON.parse(fs.readFileSync( 0, 'utf-8' ))

function main() {
  const deployPath = Object.keys(unfurlExport.DeploymentPath).find(path => path.endsWith(`/${deploymentName}`))
  const pathComponents = deployPath.split('/')
  pathComponents.pop()
  const
    blueprintName = pathComponents.pop()

  let environmentName
  while(pathComponents.length && pathComponents[pathComponents.length - 1] != 'environments') {
    environmentName = pathComponents.pop()
  }
  pathComponents.pop()

  const fixtureName = `_${environmentName}__${blueprintName}__${deploymentName}`,
    fixturePath = `generated/deployments/${fixtureName}`

  const DeploymentPath = { [deployPath]: unfurlExport.DeploymentPath[deployPath]}
  const deployment = {
    ...unfurlExport.deployments.find(dep => Object.values(dep.DeploymentTemplate || [[]])[0].name == deploymentName),
    DeploymentPath
  }

  switch(Object.keys(DeploymentPath).length) {
    case 0:
      throw new Error('No deployment records found in environments.json')
    case 1:
      break
    default:
      throw new Error('Conflicting deployment records found in environments.json')
  }

  fs.writeFileSync(
    path.join(unfurlGuiRoot, 'cypress/fixtures', `${fixturePath}.json`),
    JSON.stringify(deployment)
  )

  if(generateTest) {
    const testTemplate = fs.readFileSync(
      path.join(__dirname, 'fixture-from-deployment', 'recreate-deployment.template.js'),
      'utf-8'
    )
      .replace('$FIXTURE_PATH', fixturePath)
      .replace('$TEST_NAME', generateTest)

    fs.writeFileSync(
      path.join(unfurlGuiRoot, 'cypress/e2e/blueprints', `${generateTest}.cy.js`),
      testTemplate
    )
  }
}

main()



