#!/usr/bin/env node

const isChild = !!process.send
const path = require('path')
const {fork, spawn} = require('child_process')
const mkdirp = require('mkdirp')

const {isProgramRunning, getLogWriter} = require('./shared/daemon.js')

const unfurlGuiRoot = path.join(__dirname, '../')

async function startApollo() {
  if(isProgramRunning('apollo')) {
    process.send({stdout: 'Apollo is already running', exit: true})
    return
  }
  const writeLine = getLogWriter('apollo')
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
        writeLine(`[${(new Date()).toISOString()}] ${line}`)
        if(!resolved && line.startsWith('✔️  GraphQL Server is running on')) {
          resolve(true)
          resolved = true
          process.send({stdout: 'Apollo started', exit: true})
        }
      })
    })
    apollo.stderr.on('data', data => {
      data.toString().split('\n').forEach(line => {
        const stderr = `[${(new Date()).toISOString()}:stderr] ${line}`
        try {
          process.send({stderr})
        } catch(e) {}
        writeLine(stderr)
      })
    })
    apollo.on('exit', code => {
      process.send({stdout: `Apollo exited with ${code}`, exit: true})
    })
  })
}

async function startServe() {
  if(isProgramRunning('serve')) {
    process.send({stdout: 'Vue cli server is already running', exit: true})
    return 
  }
  const writeLine = getLogWriter('serve')
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
        writeLine(`[${(new Date()).toISOString()}] ${line}`)
        if(!resolved && line.startsWith('  App running at:')) {
          resolved = true
          process.send({stdout: 'Vue cli server started', exit: true})
          resolve(true)
        }
      })
    })
    serve.stderr.on('data', data => {
      data.toString().split('\n').forEach(line => {
        const stderr = `[${(new Date()).toISOString()}:stderr] ${line}`
        /*
         * webpack has a rediculous amount of output to stderr
        try {
          process.send({stderr})
        } catch(e) {}
        */
        writeLine(stderr)
      })
    })
    serve.on('exit', code => {
      process.send({stdout: `Vue cli server exited with ${code}`, exit: true})
    })

  })
}

const CHILD_JOBS = 2
async function main() {
  if(!isChild) {
    let exitCount = 0
    const child = fork(path.join(__dirname, 'start.js'), [], {detached: true, silent: true})
    child.on('message', ({stdout, stderr, exit}) => {
      if(stdout) {
        console.log(stdout)
      }
      if(stderr) {
        console.error(stderr)
      }
      if(exit && ++exitCount == CHILD_JOBS) {
        process.exit()
      }
    })
  } else {
    process.send({stdout: 'Starting apollo...'})
    await startApollo()
    process.send({stdout: 'Starting dev server...'})
    await startServe()
  }
}

main()
