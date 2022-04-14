#!/usr/bin/env node

const path = require('path')
const {execFileSync} = require('child_process')
const {unfurlGuiRoot} = require('./shared/util.js')
const args = process.argv.slice(2)

execFileSync(
  path.join(__dirname, 'stop.js'),
  args,
  {stdio: 'inherit'}
)

execFileSync(
  path.join(__dirname, 'start.js'),
  args,
  {stdio: 'inherit'}
)
