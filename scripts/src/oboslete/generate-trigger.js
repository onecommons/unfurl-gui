#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const INVALID_TRIGGER_VARIABLES = [ 'GOOGLE_APPLICATION_CREDENTIALS' ]

const FORWARD_ENVIRONMENT_VARIABLES = JSON.parse(fs.readFileSync(path.join(__dirname, 'forwarded-variables.json'), 'utf-8')).filter(v => !INVALID_TRIGGER_VARIABLES.includes(v))

console.log('#!/bin/sh')
const lines = []
lines.push('curl -i -X POST')
lines.push('-F "ref=cy-tests"')
lines.push('-F "token=$TOKEN"')
lines.push('-F "variables[TEST]=$1"')
for(const variable of FORWARD_ENVIRONMENT_VARIABLES) {
  lines.push(`$(test -z $${variable} || eval 'echo -n -F "variables[${variable}]=$${variable}"')`)
}

lines.push(`${process.env.CI_SERVER_URL}/api/v4/projects/${process.env.CI_PROJECT_ID}/trigger/pipeline`)

console.log(lines.join(' \\\n'))

