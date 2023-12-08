#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const {unfurlGuiRoot} = require('./shared/util')

const globSync = require('glob').sync

const TEST_VERSIONS = process.env.TEST_VERSIONS || 'v2'


const fixtures = globSync(
  path.join(
    unfurlGuiRoot,
    `cypress/fixtures/generated/deployments/${TEST_VERSIONS}`
  ) + '/*.json'
)

const testTemplate = fs.readFileSync(
  path.join(__dirname, 'fixture-from-deployment', 'recreate-deployment.template.js'),
  'utf-8'
)

const conversions = fixtures.map(fx => {
  const testName = fx.split('/').pop().slice(0, -5)
  const content = testTemplate.replace(/\$TEST_NAME/g, testName)
  return {
    fixturePath: fx,
    testName,
    specDestination: path.join(unfurlGuiRoot, `cypress/e2e/blueprints/${testName}.cy.js`),
    content
  }
})


const todo = []

for(const conversion of conversions) {
  let currentContents

  try {
    currentContents = fs.readFileSync(conversion.specDestination, 'utf8')
  } catch(e) {}

  if(currentContents) {
    if(conversion.content == currentContents) {
      console.log(`skipping ${conversion.testName}: up to date`)
      continue
    } else {
      console.log(`skipping ${conversion.testName}: contents differ`)
    }
  } else {
    todo.push(conversion)
  }
}


for(const conversion of todo) {
  console.log(`writing ${conversion.testName}`)
  fs.writeFileSync(conversion.specDestination, conversion.content)
}
