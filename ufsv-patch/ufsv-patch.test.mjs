// import regeneratorRuntime from 'regenerator-runtime/runtime'
import fs from 'fs'
import childProcess from 'child_process'
import store from './store'
import Fixture from './fixture'
import {jest} from '@jest/globals'
import {sleep} from 'oc_vue_shared/client_utils/misc'

// import {globSync} from 'glob'
import glob from 'glob'
const globSync = glob.sync

const SPEC_GLOBS = process.env.SPEC_GLOBS || ''
const TEST_VERSIONS = process.env.TEST_VERSIONS || 'v2'
const UNFURL_SERVER_CWD = process.env.UNFURL_SERVER_CWD || '/tmp/ufsv'
const OC_URL = process.env.OC_URL
const PORT = process.env.PORT || '5001'
const UNFURL_SERVER_URL =  `http://localhost:${PORT}`

const prefix = `cypress/fixtures/generated/deployments/${TEST_VERSIONS}/`
const suffix = '.json'

const fixtures = SPEC_GLOBS.split(/\s+/).map(
  spec => {
    const s = `${prefix}${spec}${suffix}`
    return globSync(`${prefix}${spec}${suffix}`)
  }
).flat()

const UNFURL_DEFAULT_ENV = {
  UNFURL_LOGGING: 'trace',
  UNFURL_HOME: '',
}

function setupCmd() {
    try {
      childProcess.execFileSync('./ufsv-patch/setup.sh', {env: {...process.env, UNFURL_SERVER_CWD}})
    } catch(e) {
      console.error(e.message)
    }
}

function spawnUnfurlServer() {
    return childProcess.spawn(
      'unfurl',
      [
        'serve',  '.',
        '--cloud-server', OC_URL,
        '--port', PORT,
        '--clone-root', '/tmp/repos'
      ],
      {
        env: {
          ...UNFURL_DEFAULT_ENV,
          ...process.env
        },
        cwd: UNFURL_SERVER_CWD,
        stdio: 'inherit' // exciting
    })
}

function spawnDryrunSync(fixture) {
  return childProcess.spawnSync(
    'unfurl',
    [
      'deploy',
      '--dryrun',
      '--use-environment', fixture.environment,
      '--approve',
      '--jobexitcode', 'error',
      fixture.deploymentDir
    ],
    {
      env: {
        ...UNFURL_DEFAULT_ENV,
        ...process.env
      },
      cwd: UNFURL_SERVER_CWD,
      stdio: 'inherit' // exciting
    }
  )
}

async function runSpecs() {
  let unfurlServer

  beforeAll(async () => {
    setupCmd()
    unfurlServer = spawnUnfurlServer()
    await sleep(2000)
    childProcess.execSync(`curl -v ${UNFURL_SERVER_URL}/version`, {stdio: 'inherit'})
  })

  afterAll(() => {
    unfurlServer.kill(2)
  })

  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    jest.resetAllMocks()
    setupCmd()
  })

  for(const path of fixtures) {
    const fixture = new Fixture(path)
    test(fixture.name, async () => {
      await fixture.test(store)
      const dryrun = spawnDryrunSync(fixture)
      expect(dryrun.status).toBe(0)
    }, 120 * 1000)
  }
}

runSpecs()
