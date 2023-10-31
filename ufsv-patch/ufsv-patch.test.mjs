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

function testToUfsvLogPath(testName) {
  return `/tmp/${testName}-ufsv.log`
}

function spawnUnfurlServer(testName) {
    const outfile = fs.openSync(testToUfsvLogPath(testName), 'w')
    return childProcess.spawn(
      '/usr/bin/env',
      [
        'unfurl',
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
        stdio: [
          'inherit',
          outfile,
          outfile
        ]
    })
}

function spawnDryrunSync(fixture) {
  return childProcess.spawnSync(
    '/usr/bin/env',
    [
      'unfurl',
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

async function sleepyCurl(n=2000) {
  await sleep(n)
  try {
    childProcess.execSync(`curl -v ${UNFURL_SERVER_URL}/version`, {stdio: 'inherit'})
    childProcess.execSync(`curl -v ${OC_URL}/-/health`, {stdio: 'inherit'})
  } catch(e) {
    console.error(e.message)
    await sleepyCurl(n+1000)
  }
}

function writeLine(...args) {
  // fs.writeFileSync(0, args.join(' ') + '\n') // doesn't work in CI?
  // process.stdin.write(args.join(' ') + '\n', 'utf8')
  childProcess.execSync('echo', [...args])
}

async function runSpecs() {
  let unfurlServer

  beforeEach(async () => {
    const testName = (expect.getState().currentTestName).split('/').pop()
    writeLine(`\\e[0Ksection_start:${testName}\\r\\e[0K${testName}`)
    window.localStorage.clear()
    window.sessionStorage.clear()
    setupCmd()
    unfurlServer = spawnUnfurlServer(testName)
    await sleepyCurl()
  }, 30 * 1000)

  afterEach(() => {
    const testName = (expect.getState().currentTestName).split('/').pop()
    writeLine(`\\e[0Ksection_end:${testName}\\r\\e[0K`)
    unfurlServer.kill(2)
  })

  for(const path of fixtures) {
    const fixture = new Fixture(path)
    test(fixture.name, async () => {
      await fixture.test(store)

      const sectionName = `${fixture.name}.dryrun`
      writeLine(`\\e[0Ksection_start:${sectionName}\\r\\e[0K${sectionName}`)
      const dryrun = spawnDryrunSync(fixture)
      writeLine(`\\e[0Ksection_end:${sectionName}\\r\\e[0K`)

      expect(dryrun.status).toBe(0)
    }, 120 * 1000)
  }
}

runSpecs()
