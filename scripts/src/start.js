#!/usr/bin/env node

const isChild = !!process.send
const path = require('path')
const {fork, spawn} = require('child_process')
const mkdirp = require('mkdirp')

const {isProgramRunning, getLogWriter} = require('./shared/daemon.js')
const {unfurlGuiRoot, sleep} = require('./shared/util.js')

let exitCodes = {}

async function startApollo() {
  if(isProgramRunning('apollo')) {
    process.send({stdout: 'Apollo is already running', exit: true})
    return
  }
  const log = getLogWriter('apollo')
  return new Promise((resolve, reject) => {
    let resolved = false
    const apollo = spawn(
      'yarn',
      ['run', 'vue-cli-service', 'apollo:start'],
      {
        cwd: unfurlGuiRoot
      }
    )
    apollo.stdout.on('data', data => {
      data.toString().split('\n').forEach(line => {
        log(line)
        if(!resolved && line.startsWith('✔️  GraphQL Server is running on')) {
          resolve(true)
          resolved = true
          process.send({stdout: 'Apollo started', exit: true})
        }
      })
    })
    apollo.stderr.on('data', data => {
      log(data, "stderr");
    })
    apollo.on('exit', code => {
      exitCodes['apollo'] = code
      const message = `Apollo exited with ${code}`
      log(message)
    })
  })
}

async function startServe() {
  if(isProgramRunning('serve')) {
    process.send({stdout: 'Vue cli server is already running', exit: true})
    return
  }
  const log = getLogWriter('serve')
  return new Promise((resolve, reject) => {
    let resolved = false
    const serve = spawn(
      'yarn',
      ['run', 'serve'],
      {
        cwd: unfurlGuiRoot
      }
    )
    serve.stdout.on('data', data => {
      data.toString().split('\n').forEach(line => {
        log(line)
        if(!resolved && line.startsWith('  App running at:')) {
          resolved = true
          process.send({stdout: 'Vue cli server started', exit: true})
          resolve(true)
        }
      })
    })
    serve.stderr.on('data', data => {
      log(data, 'stderr')
    })
    serve.on('exit', code => {
      exitCodes['serve'] = code
      const message = `Vue cli server exited with ${code}`
      log(message)
    })

  })
}

const CHILD_JOBS = 2
async function main() {
  const args = process.argv.slice(2)
  if(!isChild) {

    let exitCount = args.length || CHILD_JOBS
    const child = fork(
      path.join(__dirname, 'start.js'),
      args,
      {detached: true, silent: true}
    )
    child.on('message', ({stdout, stderr, exit}) => {
      if(stdout) {
        console.log(stdout)
      }
      if(stderr) {
        console.error(stderr)
      }
      if(exit && --exitCount == 0) {
        process.exit()
      }
    })
  } else {
    const log = getLogWriter('control')

    process.on('uncaughtException', function (err) {
      log(err.message)
      log(err.stack)
    })

    log(`my pid is ${process.pid}`)
    const shouldStartApollo = !args.length || args.includes('apollo')
    const shouldStartServe = !args.length || args.includes('serve')
    if(shouldStartApollo) {
      process.send({stdout: 'Starting apollo...'})
      log('Starting apollo...')
      await startApollo()
    }
    if(shouldStartServe) {
      process.send({stdout: 'Starting dev server...'})
      log('Starting dev server...')
      await startServe()
    }

    while(true) {
      let logMessage = []
      if(shouldStartApollo) {
        logMessage.push(`Apollo exited ${exitCodes['apollo'] || 'no'}`)
      }
      if(shouldStartServe) {
        logMessage.push(`Dev server exited ${exitCodes['serve'] || 'no'}`)
      }
      log(logMessage.join(';\t'))
      if(
        (shouldStartApollo && isProgramRunning('apollo')) ||
        (shouldStartServe && isProgramRunning('serve'))
      ) {
        await sleep(5000)
      } else {
        log('Exiting')
        break
      }
    }
  }
}

main()
