#!/usr/bin/env node

const {execFileSync, spawnSync} = require('child_process')
const axios = require('axios')
const path = require('path')
const fs = require('fs')
const {unfurlGuiRoot} = require('./shared/util.js')

const OC_USERNAME = process.env.OC_USERNAME
const OC_PASSWORD = process.env.OC_PASSWORD
let PORT = process.env.PORT
const OC_URL = process.env.OC_URL || (PORT? `http://localhost:${PORT}`: 'http://localhost:5001')
const UNFURL_CLOUD_SERVER = process.env.UNFURL_CLOUD_SERVER || process.env.OC_URL
const OC_INVITE_CODE = process.env.OC_INVITE_CODE
const OC_DISCRIMINATOR = process.env.OC_DISCRIMINATOR
const EXTERNAL = process.env.hasOwnProperty('EXTERNAL')? process.env['EXTERNAL'] || '1' : '1'
const STANDALONE_UNFURL = OC_URL.includes('://localhost') 
const ENV_NAMING_FUNCTION = process.env.ENV_NAMING_FUNCTION || (STANDALONE_UNFURL? 'identity' : 'identifierFromCurrentTime')
const UNFURL_TEST_TMPDIR = process.env.UNFURL_TEST_TMPDIR = path.resolve(process.env.UNFURL_TEST_TMPDIR || "/tmp")
const STANDALONE_PROJECT_DIR = `${UNFURL_TEST_TMPDIR}/ufsv`
let unfurlServer
let code = 0

if(STANDALONE_UNFURL && ! PORT) {
  PORT = new URL(OC_URL).port
}


process.env.UNFURL_HOME = path.join(UNFURL_TEST_TMPDIR, './unfurl_home')
process.env.UNFURL_NORUNTIME = true
process.env.OC_URL = OC_URL

const LOCAL_ONLY = !!(STANDALONE_UNFURL && (!UNFURL_CLOUD_SERVER || UNFURL_CLOUD_SERVER == OC_URL))

if(LOCAL_ONLY) {
  console.log('Running a local only test - there is no defined upstream')
} else if(STANDALONE_UNFURL) {
  console.log(`Running a local test against ${UNFURL_CLOUD_SERVER}`)
} else {
  console.log(`Running test against an Unfurl Cloud instance: ${OC_URL}`)
}

// not used unless local only
const STANDALONE_SETUP_SCRIPT = process.env.STANDALONE_SETUP_SCRIPT || 'testing-shared/setup.sh'
if(process.env.STANDALONE_SETUP_SCRIPT) {
  console.log(`Using a parameterized setup script ${process.env.STANDALONE_SETUP_SCRIPT}`)
}

if(!LOCAL_ONLY && process.env.STANDALONE_SETUP_SCRIPT) {
  console.warn('Contradictory test parameters: STANDALONE_SETUP_SCRIPT can not be used with UNFURL_CLOUD_SERVER or OC_URL')
}

process.env.FAIL_FAST_ENABLED = process.env.FAIL_FAST_ENABLED || 'false'

if(STANDALONE_UNFURL) {
  // allow some specs to self-filter
  process.env.NO_FLAKY = '1'
  process.env.DRYRUN = '1'
  process.env.STANDALONE_UNFURL = STANDALONE_UNFURL
}

const GENERATED_PASSWORD = btoa(Number.MAX_SAFE_INTEGER * Math.random())
const FIXTURES_TMP = path.join(unfurlGuiRoot, 'cypress/fixtures/tmp')


if(STANDALONE_UNFURL && !process.env.DASHBOARD_DEST) {
  process.env.DASHBOARD_DEST = STANDALONE_PROJECT_DIR
}


const READ_ARGS = {
  username: (args) => {
    if(LOCAL_ONLY) {
      return 'jest'
    }

    return args.u || args.username
  },
  cypressEnv: (args) => args.e || args.env || args['cypress-env'],
  dashboardRepo: (args) => args.dashboard || args['dashboard-repo'],
  group: (args) => args.group,
  REPOS_NAMESPACE: (args) => args.namespace || args['repo-namespace'] || args['repos-namespace'],
  awsAuthMethod: (args) => {
    const authMethod = args['aws-auth-method'] || args['aws-auth']
    switch(authMethod?.toLowerCase()) {
      case 'token': return 'token'
      case 'key': return 'token'
      default: return null
    }
  },
}

function readArgs(args) {
  const result = {}
  Object.entries(READ_ARGS).forEach(([argName, valueFn]) => result[argName] = valueFn(args) ?? null)
  return result
}

function fetchNamespaceProjects(namespace) {
  async function doFetch() {
    try {
      const projects = []
      for(let i = 1;; i++) {
        const url = `${OC_URL}/groups/${namespace}/-/children.json?page=${i}`
        const children = (await axios.get(url)).data
        if(children.length > 100) {
          throw new Error(`Encountered more than 100 "projects" on a page - "${namespace}" probably has a typo`)
        }
        if(children.length == 0) break
        for(const child of children) {
          if(child.type == 'project') {
            projects.push(child)
          }
        }
      }
      return projects
    } catch(e) {
      console.error(e)
      return []
    }
  }

  return fetchNamespaceProjects[namespace] || (fetchNamespaceProjects[namespace] = doFetch())
}

const ENVIORONMENT_VARIABLE_TRANSFORMATIONS = {
  'GOOGLE_APPLICATION_CREDENTIALS': (value) => {
    let dest = path.basename(value)

    // ci drops .json extension needed for fixtures
    if(!dest.endsWith('.json')) {
      dest = `${dest}.json`
    }
    fs.copyFileSync(value, path.join(FIXTURES_TMP, dest))
    return `/tmp/${dest}`
  }
}

function transformEnvironmentVariables(key, value) {

  let transformation
  if(transformation = ENVIORONMENT_VARIABLE_TRANSFORMATIONS[key]) {
    return transformation(value)
  }
  return value
}

const INTERNAL_TEST_VARIALBES = [
  'OC_IMPERSONATE',
  'DO_ENVIRONMENT_NAME',
  'AWS_ENVIRONMENT_NAME',
  'GCP_ENVIRONMENT_NAME',
  'AZ_ENVIRONMENT_NAME',
  'GENERATED_PASSWORD',
  'EXTERNAL',
  'NAMESPACE_PROJECTS',
  'STANDALONE_UNFURL',
  'UNFURL_NORUNTIME',
  'UNFURL_HOME',
  "UNFURL_TEST_TMPDIR"
]  // always overriden

const FORWARD_ENVIRONMENT_VARIABLES = [
  ...JSON.parse(fs.readFileSync(path.join(__dirname, 'forwarded-variables.json'), 'utf-8')),
  ...INTERNAL_TEST_VARIALBES
]



async function forwardedEnvironmentVariables(override) {
  const result = {}

  for(const envvar of FORWARD_ENVIRONMENT_VARIABLES) {
    let value = override[envvar] || process.env[envvar]
    if(value ?? null !== null) {
      result[`CYPRESS_${envvar}`] = transformEnvironmentVariables(envvar, value)
    }
  }
  return result
}


const ENV_NAMING_FUNCTIONS = {
  identifierFromCurrentTime(baseId) {
    const d = new Date(Date.now())

    const discriminator = OC_DISCRIMINATOR || d.toISOString().replace(/(:|\.|-)/g, '')
    return `${baseId}-${discriminator}`
  },
  identity(baseId) { return baseId}
}

function createDashboardCommand(username, dashboardRepo) {
  const
    createUser = path.join(__dirname, 'create-user.js'),
    createUserArgs = ['--username', username, '--external', EXTERNAL],
    options = {stdio: 'inherit'}
  if(dashboardRepo) {
    createUserArgs.push('--dashboard')
    createUserArgs.push(dashboardRepo)
  }
  if(!(OC_USERNAME && OC_PASSWORD) || STANDALONE_UNFURL) {
    createUserArgs.push('--password')
    createUserArgs.push(GENERATED_PASSWORD)
  }
  if(STANDALONE_UNFURL) {
    createUserArgs.push('--select-role')
  }
  if(OC_INVITE_CODE) {
    createUserArgs.push('--invite-code')
    createUserArgs.push(OC_INVITE_CODE)
  }
  return () => {
    execFileSync(createUser, createUserArgs, options)
    console.log(`Dashboard created for ${username}`)
    if(STANDALONE_UNFURL) {
      try {
        fs.rmdirSync(process.env.DASHBOARD_DEST, {force: true, recursive: true})
      } catch(e) {console.error(e.message, process.env.DASHBOARD_DEST)}

      const env = {
        ...(options.env || {}),
        ...process.env,
      }
      delete env['OC_TOKEN']

      execFileSync(
        path.join(__dirname, 'unfurl-clone.js'),
        [
          '--username', username,
          '--password', GENERATED_PASSWORD,
          process.env.DASHBOARD_DEST
        ],
        {
          ...options,
          env
        }
      )
    }
  }
}

async function invokeCypressCommand(baseArgs, forwardedEnv) {
  if(!baseArgs.includes('-s') && baseArgs[0] == 'run') {
    process.env.SPEC_GLOBS = process.env.SPEC_GLOBS || '*'
    const {getBlueprintSpecs} = (await import('../../testing-shared/fixture-specs.mjs'))
    baseArgs.push('-s')
    baseArgs.push(getBlueprintSpecs())
  }

  const args = ['run', 'cypress', ...baseArgs]
  const options = {stdio: 'inherit', env: {...process.env, ...forwardedEnv}}
  return spawnSync.bind(null, 'yarn', args, options)
}

async function main() {
  const args = require('minimist')(process.argv.slice(2))
  let prepareUserCommand

  const parsedArgs = readArgs(args)
  let {username, awsAuthMethod, cypressEnv, dashboardRepo, REPOS_NAMESPACE, group} = parsedArgs

  if(!REPOS_NAMESPACE) REPOS_NAMESPACE = 'testing'

  if(STANDALONE_UNFURL) {
    try {
      // don't worry it's be set to something else
      fs.rmdirSync(process.env.UNFURL_HOME, {force: true, recursive: true})
    } catch(e) {}
  }

  if(!username) {
    // we need to create a new user
    username = ENV_NAMING_FUNCTIONS.identifierFromCurrentTime('user')
    prepareUserCommand = createDashboardCommand(username, dashboardRepo)
  } else if (username == 'nobody') {
    username = undefined
  }

  if(username && !process.env.DASHBOARD_DEST) {
    process.env.DASHBOARD_DEST = `${username}/dashboard`
  }

  if(username && UNFURL_CLOUD_SERVER) console.log(`${UNFURL_CLOUD_SERVER}/${username}/dashboard/-/deployments`)

  const GCP_ENVIRONMENT_NAME = ENV_NAMING_FUNCTIONS[ENV_NAMING_FUNCTION]('gcp').toLowerCase()
  const AWS_ENVIRONMENT_NAME = ENV_NAMING_FUNCTIONS[ENV_NAMING_FUNCTION]('aws').toLowerCase()
  const DO_ENVIRONMENT_NAME = ENV_NAMING_FUNCTIONS[ENV_NAMING_FUNCTION]('do').toLowerCase()
  const K8S_ENVIRONMENT_NAME = ENV_NAMING_FUNCTIONS[ENV_NAMING_FUNCTION]('k8s').toLowerCase()
  const AZ_ENVIRONMENT_NAME = ENV_NAMING_FUNCTIONS[ENV_NAMING_FUNCTION]('az').toLowerCase()
  const INTEGRATION_TEST_ARGS = JSON.stringify(parsedArgs)

  const NAMESPACE_PROJECTS = STANDALONE_UNFURL? []: (await fetchNamespaceProjects(REPOS_NAMESPACE)).map(p => p.name).join(',')

  if(!STANDALONE_UNFURL) {
    fs.writeFileSync(path.join(FIXTURES_TMP, 'namespace_projects.json'), JSON.stringify(await fetchNamespaceProjects(REPOS_NAMESPACE)))
  }

  let env = {OC_IMPERSONATE: username, GENERATED_PASSWORD, AWS_ENVIRONMENT_NAME, GCP_ENVIRONMENT_NAME, DO_ENVIRONMENT_NAME, K8S_ENVIRONMENT_NAME, AZ_ENVIRONMENT_NAME, REPOS_NAMESPACE, INTEGRATION_TEST_ARGS, NAMESPACE_PROJECTS}

  if(group) {
    env.DEFAULT_NAMESPACE = group
  }

  const forwardedEnv = await forwardedEnvironmentVariables(env)

  if(!username || STANDALONE_UNFURL) {
    delete forwardedEnv['CYPRESS_OC_USERNAME']
    delete forwardedEnv['CYPRESS_OC_PASSWORD']
    delete forwardedEnv['CYPRESS_OC_IMPERSONATE']
  }

  if(STANDALONE_UNFURL ) {
    if(!LOCAL_ONLY) {
      delete forwardedEnv['CYPRESS_DASHBOARD_DEST'] // has ambiguous meaning for standalone with upstream
    }
    else {
      forwardedEnv['CYPRESS_DASHBOARD_DEST'] = 'local:' + forwardedEnv['CYPRESS_DASHBOARD_DEST']
    }
  }

  const cypressCommand = await invokeCypressCommand(args._, forwardedEnv)


  if(prepareUserCommand) prepareUserCommand()

  if(group) {
    console.log(`Attempting to create group ${group}`)
    try {
      execFileSync(path.join(__dirname, 'create-group.js'), [group], {stdio:'inherit'})
    } catch(e) { console.error(e.message) }
    console.log(`Attempting to add ${username} to ${group}`)
    try {
      execFileSync(path.join(__dirname, 'add-group-member.js'), ['--user', username, '--group', group], {stdio:'inherit'})
    } catch(e) { console.error(e.message) }

    if(dashboardRepo) {
      console.log(`Pushing dashboard to ${group}/dashboard`)
      try {
        execFileSync(path.join(__dirname, 'push-local-repo.js'), [dashboardRepo, '--project-path', `${group}/dashboard`], {stdio: 'inherit'})
      } catch(e) { console.error(e.message) }
    }
  }

  if(STANDALONE_UNFURL) {

    if(LOCAL_ONLY) {
      execFileSync(STANDALONE_SETUP_SCRIPT, {
        env: {
          ...process.env,
          UNFURL_SERVER_CWD: process.env.DASHBOARD_DEST
        },
        stdio: 'inherit'
      })
    }

    const UnfurlServer = (await import('../../testing-shared/unfurl-server.mjs')).default

    unfurlServer = new UnfurlServer({
      cwd: STANDALONE_PROJECT_DIR,
      gui: true,
      env: {
        UNFURL_LOGGING: 'trace',
        UNFURL_HOME: process.env.UNFURL_HOME,
        UNFURL_SKIP_SAVE: 'never',
        UFGUI_DIR: unfurlGuiRoot
      },
      port: PORT,
      cloudServer: null,
      outfile: `${UNFURL_TEST_TMPDIR}/unfurl.log`
    })

    let ready = false

    unfurlServer.process.on('exit', () => {
      if(!ready) {
        console.error('Unfurl server exited early')
        process.exit(1)
      }
    })

    await unfurlServer.waitUntilReady()
    ready = true
  }
  const cypressResult = cypressCommand()
  code = cypressResult.status
}

let shouldReportExit = true

async function beforeExit() {
  if(unfurlServer) {
    unfurlServer.process.kill()
    setInterval(() => {
      unfurlServer.process.kill('SIGKILL')
    }, 5000)
    await unfurlServer.waitForExit()
    if(shouldReportExit) {
      console.log('unfurl serve exited')
    }
    shouldReportExit = false
  }
}

process.on('SIGINT', beforeExit)

async function tryMain() {
  try {
    await main()
  } catch(e) {
    // console.error('Error:', e.message)
    console.error(e)
    code = 1
  } finally {
    await beforeExit()
  }
  process.exit(code)
}

tryMain()
