#!/usr/bin/env node

const YAML = require('yaml')
const fs = require('fs')
const path = require('path')
const {unfurlGuiRoot} = require('./shared/util')

const ciTestsFileContents = fs.readFileSync(path.join(unfurlGuiRoot, '.gitlab/ci-tests.yml'), 'utf-8')
const ciTests = YAML.parse(ciTestsFileContents)

let output = ''

fs.readdirSync(path.join(unfurlGuiRoot, '.readme')).forEach(readmeChunk => {
  output += fs.readFileSync(path.join(unfurlGuiRoot, '.readme', readmeChunk), 'utf-8') + '\n\n'
})


output  += '# Cypress tests\n\n Cypress tests can be automatically run through gitlab ci by setting the `$TEST` pipeline variable'

output += '\n\n| Pattern | Spec | Description |'
output +=   '\n| ------- | ---- | ----------- |'
Object.entries(ciTests).forEach(([key, value]) => {
  const {spec, cond, description} = value

  output += `\n| <code>${cond.replace(/\|/g, '&#124;')}</code> | <code>${spec.replace(/\*/g, '&#42;').split(',').join('</code><br><code>')}</code> | ${description.replace(/\n/g, '<br>')} |`
})

output += '\n| <code>$TEST == "command"</code> | N/A | evals <code>$CY_COMMAND</code>'

output += `\n
## Running an arbitrary test examples with \`$CY_COMMAND\`

* Run a single spec by setting \`$CY_COMMAND\` to : <code>yarn run integration-test run --namespace onecommons/blueprints -- --browser chrome -s cypress/e2e/deployments/drafts.cy.js</code>
`
console.log(output)
