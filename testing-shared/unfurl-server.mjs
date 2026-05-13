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


    if(this.outfile != 'inherit') {
      if(Number.isInteger(this.outfile)) {
        this.fd = this.outfile
      } else {
        childProcess.execSync(`touch ${this.outfile}`)
        this.fd = fs.openSync(this.outfile, 'a')
      }
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
          this.fd || this.outfile,
          this.fd || this.outfile,
        ]
      }
    ]
      

    const [cmd, cmdArgs, opts] = this.invocation
    console.log(`[unfurl-server] cwd=${opts.cwd} cmd: ${cmd} ${cmdArgs.join(' ')}`)
    const interesting = /^(UNFURL_|OC_|AWS_|GCP_|GOOGLE_|AZURE_|ARM_|DIGITALOCEAN_|PORT$|PATH$|HOME$|NODE_OPTIONS$|MAIL_|SMTP_|CYPRESS_)/
    const isSecret = /TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY/i
    const envSnapshot = Object.fromEntries(
      Object.entries(opts.env)
        .filter(([k]) => Object.prototype.hasOwnProperty.call(this.env, k) || interesting.test(k))
        .map(([k, v]) => [k, isSecret.test(k) ? '<redacted>' : v])
        .sort()
    )
    console.log(`[unfurl-server] env:`, envSnapshot)

    this.process = childProcess.spawn(
      ...this.invocation
    )
  }

  async waitUntilReady(interval=1000) {
    if(! this.timeout) {
      this.timeout = sleep(interval * 10).then(async (_) => {
        if(this.ready) return
        process.exit(2)
      })
    }
    try {
      childProcess.execSync(`curl 127.0.0.1:${this.port}/version`, {stdio: 'inherit'})
      this.ready = true
      console.log('unfurl ready')
    } catch(e) {
      console.error(e.message)
      await sleep(interval)
      await this.waitUntilReady(interval)
    }
  }

  waitForExit() {
    return new Promise(resolve => {
      this.process.on('close', resolve)
    })
  }
}
