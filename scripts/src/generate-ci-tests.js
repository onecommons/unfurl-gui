#!/usr/bin/env node

const YAML = require('yaml')
const fs = require('fs')
const path = require('path')
const {unfurlGuiRoot} = require('./shared/util')

const ciTestsFileContents = fs.readFileSync(path.join(unfurlGuiRoot, '.gitlab/ci-tests.yml'), 'utf-8')
const ciTests = YAML.parse(ciTestsFileContents)


const result = {}

Object.entries(ciTests).forEach(([key, value]) => {
  const {spec, cond, env, username} = value
  result[key] = {
    'extends': '.tests',
    script: [
      `${env || ''} yarn run integration-test run ${username? `--username ${username}`: ''} --namespace $OC_NAMESPACE -- --browser chrome -s '${spec}'`
    ],
    rules: [
      { 'if': cond }
    ]
  }
})

console.log(YAML.stringify(result))
