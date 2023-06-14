#!/usr/bin/env node

const YAML = require('yaml')
const fs = require('fs')
const path = require('path')
const {unfurlGuiRoot} = require('./shared/util')

const ciTestsFileContents = fs.readFileSync(path.join(unfurlGuiRoot, '.gitlab/ci-tests.yml'), 'utf-8')
const ciTests = YAML.parse(ciTestsFileContents)


const result = {}

Object.entries(ciTests).forEach(([key, value]) => {
  const {spec, cond, env} = value
  result[key] = {
    'extends': '.tests',
    script: [
      `${env || ''} yarn run integration-test run --namespace onecommons/blueprints -- --browser chrome -s '${spec}'`
    ],
    rules: [
      { 'if': cond }
    ]
  }
})

console.log(YAML.stringify(result))
