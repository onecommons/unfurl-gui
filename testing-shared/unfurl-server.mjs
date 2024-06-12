import childProcess from 'child_process'
import fs from 'fs'

function sleep(n) {
  return new Promise((resolve) => {
    setTimeout(resolve, n)
  })
}

const UNFURL_CMD = process.env.UNFURL_CMD || 'unfurl'
const OC_URL = process.env.OC_URL || 'https://unfurl.cloud'
const PORT = process.env.PORT || '5001'

export default class UnfurlServer {
  constructor(params) {

    Object.assign(
      this,
      {
        cmd: UNFURL_CMD,
        gui: false,
        cwd: '', 
        env: {},
        cloudServer: OC_URL,
        port: PORT,
        cloneRoot: null,
        outfile: 'inherit',
      },
      params
    )

    const args = [this.cmd, 'serve']

    if(this.cloneRoot) {
      args.push('--clone-root')
      args.push(this.cloneRoot)
    }

    if(this.cloudServer) {
      args.push('--cloud-server')
      args.push(this.cloudServer)
    }

    if(this.port) {
      args.push('--port')
      args.push(this.port)
    }

    if(this.gui) {
      args.push('--gui')
    }

    let fd

    if(Number.isInteger(this.outfile)) {
      fd = this.outfile
    } else {
      childProcess.execSync(`touch ${this.outfile}`)
      fd = fs.openSync(this.outfile, 'a')
    }
    
    this.invocation = [
      '/usr/bin/env',
      args,
      {
        env: {
          ...this.env,
          ...process.env
        },
        cwd: this.cwd,
        stdio: [
          'inherit',
          fd,
          fd,
        ]
      }
    ]
      

    this.process = childProcess.spawn(
      ...this.invocation
    )
  }

  async waitUntilReady(interval=1000) {
    try {
      childProcess.execSync(`curl localhost:${this.port}/version`, {stdio: 'inherit'})
      console.log('unfurl ready')
    } catch(e) {
      console.error(e.message)
      await sleep(interval)
      await this.waitUntilReady(interval)
    }
  }
}
