#!/usr/bin/env node

const TEST_VERSIONS = process.env.TEST_VERSIONS || 'v2'
const axios = require('./shared/axios-instance.js')
const login = require('./shared/login')
const path = require('path')
const {unfurlGuiRoot} = require('./shared/util.js')
const fs = require('fs')
const args = require('minimist')(process.argv.slice(2))

const deploymentName = args.deployment || args['deployment-name']
const username = args.username
const dashboard = args.dashboard || (args.username && `${args.username}/dashboard`)
const unfurlServer = args.unfurlServer || args['unfurl-server'] || `${process.env.OC_URL}/services/unfurl-server`
// const generateTest = args['test-name'] || args['test'] || args['generate-test']
const fixtureName = args.fixtureName || args['fixture-name'] || args['test']
const fixturePath = `generated/deployments/${TEST_VERSIONS}/${fixtureName}`
const renameDeployment = args.rename


async function main() {
  const requiredParams = {
    dashboard, deploymentName, fixtureName
  }

  Object.entries(requiredParams).forEach(([key, value]) => {
    if(!value) {
      throw new Error(`Expected value for ${key}`)
    }
  })

  await login(process.env.OC_URL, process.env.OC_USERNAME, process.env.OC_PASSWORD)
  const response = await axios.get(
    `${unfurlServer}/export?format=environments&branch=main&auth_project=${encodeURIComponent(dashboard)}&include_all_deployments=1`,
    {
      headers: {'x-git-credentials': btoa(`${process.env.OC_USERNAME}:${process.env.OC_PASSWORD}`)}
    }
  )

  const deployment = response.data.deployments.find(deploymentDict => Object.values(deploymentDict.Deployment)[0].name == deploymentName)
  const deployPath = Object.keys(response.data.DeploymentPath).find(path => path.endsWith(`/${deploymentName}`))

  if(!(deployment && deployPath)) {
    throw new Error('Deployment not found')
  }

  if(renameDeployment) {
    Object.values(deployment.Deployment)[0].title = renameDeployment
    Object.values(deployment.DeploymentTemplate)[0].title = renameDeployment
  }

  const fixture = {
    ...deployment,
    DeploymentPath: {
      [deployPath]: response.data.DeploymentPath[deployPath]
    }
  }

  fs.writeFileSync(
    path.join(unfurlGuiRoot, 'cypress/fixtures', `${fixturePath}.json`),
    JSON.stringify(fixture)
  )

  console.log(`${fixturePath}.json written`)
}

async function tryMain() {
  try {
    await main()
  } catch(e) {
    console.error(e.message)
  }
}


tryMain()
