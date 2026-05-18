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
// When set, run `unfurl serve` inside this docker image instead of locally.
// The image is expected to be the unfurl server build (Dockerfile.server),
// which bundles the rust unfurl-server binary and all of unfurl's optional
// Python deps (e.g. redis) that a pipx install would miss.
const UNFURL_SERVER_IMAGE = process.env.UNFURL_SERVER_IMAGE || ''
// Container env vars to forward from the caller into the container.
const DOCKER_ENV_FORWARD = [
  'UNFURL_LOGGING',
  'UNFURL_HOME',
  'UNFURL_GUI_DIR',
  'UNFURL_SKIP_SAVE',
  'UNFURL_NORUNTIME',
  'CACHE_REDIS_URL',
  'CACHE_KEY_PREFIX',
]

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
        image: UNFURL_SERVER_IMAGE,
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

    let invocationArgs = args
    if (this.image) {
      // Bind-mount the host's cwd at the same absolute path inside the
      // container so every path our caller already resolved (UNFURL_HOME,
      // UNFURL_SERVER_CWD, this.cwd, etc.) is valid inside too — no
      // host-vs-container path translation needed.
      const hostRoot = process.cwd()
      const mergedEnv = {...this.env, ...process.env}
      const dockerArgs = [
        'docker', 'run', '--rm', '-i',
        '--name', 'unfurl-test-server',
        '--network', 'host',
        '-v', `${hostRoot}:${hostRoot}`,
        '-w', this.cwd || hostRoot,
        '--user', `${process.getuid()}:${process.getgid()}`,
        // The image's USER directive is `unfurl:unfurl`, but --user overrides
        // it to the runner's uid which has no /etc/passwd entry. Two
        // consequences ansible chokes on at import time:
        //   - HOME resolves to '/' (no pwd entry), so mkdir /.ansible/tmp
        //     crashes with EACCES → set HOME=/tmp (always writable; the
        //     container is --rm so anything written there is disposable)
        //   - getpass.getuser() raises 'uid not found' → seed USER so the
        //     fallback to env vars works (any non-empty string is fine)
        '-e', 'HOME=/tmp',
        '-e', 'USER=unfurl',
        '--entrypoint', 'unfurl',
      ]
      for (const v of DOCKER_ENV_FORWARD) {
        if (mergedEnv[v] !== undefined && mergedEnv[v] !== '') {
          dockerArgs.push('-e', `${v}=${mergedEnv[v]}`)
        }
      }
      dockerArgs.push(this.image)
      // Strip the leading `unfurl` cmd; the --entrypoint provides it.
      dockerArgs.push(...args.slice(1))
      invocationArgs = dockerArgs
    }

    this.invocation = [
      '/usr/bin/env',
      invocationArgs,
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

    if (this.image) {
      // SIGKILL on the docker client doesn't always propagate to the
      // container; arrange for the container to be killed by name on exit
      // of either side.
      const containerName = 'unfurl-test-server'
      const killContainer = () => {
        try { childProcess.execSync(`docker kill ${containerName}`, {stdio: 'ignore'}) } catch (e) {}
      }
      this.process.on('exit', killContainer)
      process.on('exit', killContainer)
    }
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
