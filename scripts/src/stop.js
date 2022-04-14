#!/usr/bin/env node

const {isProgramRunning, getPid} = require('./shared/daemon.js')
const args = process.argv.slice(2)
const stopServe = args.length == 0 || args.includes('serve')
const stopApollo = args.length == 0 || args.includes('apollo')

if(stopServe && isProgramRunning('serve')) {
  try {
    process.kill(getPid('serve', 2))
    console.log('Sent SIGINT to dev server')
  } catch(e) {
    console.error(e)
  }
} else if (stopServe){
  console.log('Dev server is not running')
}

if(stopApollo && isProgramRunning('apollo')) {
  try {
    process.kill(getPid('apollo', 2))
    console.log('Sent SIGINT to apollo')
  } catch(e) {
    console.error(e)
  }
} else if (stopApollo){
  console.log('Apollo is not running')
}
