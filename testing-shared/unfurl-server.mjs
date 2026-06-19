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
  'UNFURL_BATCH_WINDOW_SECS',
  // Caps the LocalEnv parent-walk so unfurl serve doesn't ascend past
  // the test workspace and adopt a sibling/ancestor project (e.g.
  // unfurl-gui's own _unfurl/) as the project — which leaves the
  // patched ensemble's manifest.repo None.
  'UNFURL_SEARCH_ROOT',
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

    // When using bridge networking inside a container, the listener must
    // bind to 0.0.0.0 so `-p <port>:<port>` actually reaches it. Default
    // `unfurl serve --address localhost` only binds to the container's
    // own loopback. (Caller must set the env var; only relevant when
    // also setting UNFURL_SERVER_DOCKER_BRIDGE=1.)
    if (this.image && process.env.UNFURL_SERVER_DOCKER_BRIDGE === '1') {
      args.push('--address')
      args.push(process.env.UNFURL_HOST || '0.0.0.0')
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
      // Extra `-v` mounts via UNFURL_SERVER_EXTRA_MOUNTS (comma-separated
      // host:container entries) — for surfacing things outside the repo
      // cwd, e.g. mounting a local edit of unfurl source over the
      // installed copy in the image during debugging.
      const extraMounts = (mergedEnv.UNFURL_SERVER_EXTRA_MOUNTS || '')
        .split(',').map(s => s.trim()).filter(Boolean)
        .flatMap(m => ['-v', m])
      // Docker Desktop's --network host is opt-in (Settings → Resources →
      // Network → "Enable host networking") and even when enabled is unreliable
      // on macOS for host→container reachability. Set
      // UNFURL_SERVER_DOCKER_BRIDGE=1 to use bridge networking with explicit
      // -p port forwarding instead. CACHE_REDIS_URL should then point at
      // `host.docker.internal:<port>` (or `redis://host.docker.internal:6379/0`
      // for a default redis on the host).
      const useBridge = mergedEnv.UNFURL_SERVER_DOCKER_BRIDGE === '1'
      const port = String(this.port)
      const networkArgs = useBridge
        ? ['-p', `${port}:${port}`]
        : ['--network', 'host']
      // `unfurl serve --address 0.0.0.0` is appended above when useBridge
      // is true, so the container's listener is reachable via the -p
      // forward.
      const dockerArgs = [
        'docker', 'run', '--rm', '-i',
        '--name', 'unfurl-test-server',
        ...networkArgs,
        '-v', `${hostRoot}:${hostRoot}`,
        ...extraMounts,
        '-w', this.cwd || hostRoot,
        '--user', `${process.getuid()}:${process.getgid()}`,
        // The image's USER directive is `unfurl:unfurl`, but --user overrides
        // it to the runner's uid which has no /etc/passwd entry. Several
        // tools then choke on missing identity bits at startup:
        //   - HOME resolves to '/' (no pwd entry), so ansible's mkdir
        //     /.ansible/tmp crashes with EACCES → HOME=/tmp (always
        //     writable; --rm container, so disposable)
        //   - getpass.getuser() raises 'uid not found' → seed USER so the
        //     env-var fallback works (any non-empty string is fine)
        //   - git commits need a committer identity. The runner's
        //     `git config --global ...` writes to /home/runner/.gitconfig
        //     which isn't visible inside the container, so we pass the
        //     identity via git's native env-var overrides instead.
        '-e', 'HOME=/tmp',
        '-e', 'USER=unfurl',
        '-e', 'GIT_AUTHOR_NAME=unfurl',
        '-e', 'GIT_AUTHOR_EMAIL=unfurl@example.com',
        '-e', 'GIT_COMMITTER_NAME=unfurl',
        '-e', 'GIT_COMMITTER_EMAIL=unfurl@example.com',
        // Force init.defaultBranch=main inside the container (the image has
        // no global git config, so git would default to "master" and unfurl
        // init's commits would live on the wrong branch — the tests look up
        // "main").
        '-e', 'GIT_CONFIG_COUNT=1',
        '-e', 'GIT_CONFIG_KEY_0=init.defaultBranch',
        '-e', 'GIT_CONFIG_VALUE_0=main',
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
      // Default 10s readiness timeout is fine for native runs but too tight
      // for `--platform linux/amd64` emulated on Apple Silicon, where the
      // rust + python startup can easily take 15–30s. Tunable via env.
      const maxWaitSecs = parseInt(process.env.UNFURL_SERVER_READY_TIMEOUT_SECS || '10', 10)
      this.timeout = sleep(interval * maxWaitSecs).then(async (_) => {
        if(this.ready) return
        process.exit(2)
      })
    }
    try {
      const version = childProcess.execSync(`curl -s 127.0.0.1:${this.port}/version`).toString()
      this.ready = true
      console.log(`unfurl version: ${version}`)
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
