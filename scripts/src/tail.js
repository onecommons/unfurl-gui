#!/usr/bin/env node

const {spawn} = require('child_process')
const path = require('path')
const {logDir} = require('./shared/daemon.js')
const program = process.argv[process.argv.length - 1]

console.log('tail', ['-qf', path.join(logDir, `${program}.log`)])
spawn('tail', ['-qf', path.join(logDir, `${program}.log`)], {stdio: 'inherit'})
