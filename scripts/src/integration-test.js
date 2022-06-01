#!/usr/bin/env node


const {execFileSync, spawnSync} = require('child_process')
const path = require('path')
const fs = require('fs')
const {unfurlGuiRoot} = require('./shared/util.js')

const READ_ARGS = {
  username: (args) => args.u || args.username,
  cypressEnv: (args) => args.e || args.env || args['cypress-env'],
  dashboardRepo: (args) => args.dashboard || args['dashboard-repo'],
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


const ENVIORONMENT_VARIABLE_TRANSFORMATIONS = {
  'GOOGLE_APPLICATION_CREDENTIALS': (value) => {
    const targetDir = path.join('tmp', path.basename(value))
    fs.copyFileSync(value, path.join(unfurlGuiRoot, 'cypress/fixtures', targetDir))
    return targetDir
  }

}

function transformEnvironmentVariables(key, value) {

  let transformation
  if(transformation = ENVIORONMENT_VARIABLE_TRANSFORMATIONS[key]) {
    return transformation(value)
  }
  return value
}

const FORWARD_ENVIRONMENT_VARIABLES = [
  'OC_USERNAME',
  'OC_PASSWORD',
  'OC_URL',
  'AWS_ACCESS_KEY_ID',
  'AWS_DEFAULT_REGION',
  'AWS_SECRET_ACCESS_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'REPOS_NAMESPACE',
  'SIMPLE_BLUEPRINT',
  'DIGITALOCEAN_TOKEN',
  'MOCK_DEPLOY', 'UNFURL_MOCK_DEPLOY',
  'OC_IMPERSONATE', 'AWS_ENVIRONMENT_NAME', 'GCP_ENVIRONMENT_NAME', // always overriden
  'DIGITALOCEAN_DNS_NAME',
  'MAIL_USERNAME', 'MAIL_PASSWORD', 'SMTP_HOST', 'MAIL_RESOURCE_NAME'
]



function forwardedEnvironmentVariables(override) {
  const result = {}
  for(const envvar of FORWARD_ENVIRONMENT_VARIABLES) {
    let value
    if(value = override[envvar] || process.env[envvar]) {
      result[`CYPRESS_${envvar}`] = transformEnvironmentVariables(envvar, value)
    }
  }
  return result
}


const ERROR_CREATE_USER_NO_DASHBOARD = 'A dashboard must be specified if a user is to be created.  Specify either --username or --dashboard-repo'

function identifierFromCurrentTime(baseId) {
  const d = new Date(Date.now())
  return `${baseId}-${d.toISOString().replace(/(:|\.)/g, '-').slice(0,-5)}`
}

function createDashboardCommand(username, dashboardRepo) {
  //if(!dashboardRepo) { throw new Error(ERROR_CREATE_USER_NO_DASHBOARD) }
  const 
    file = path.join(__dirname, 'create-user.js'),
    args = ['--username', username],//, '--dashboard', dashboardRepo],
    options = {}
  if(dashboardRepo) {
    args.push('--dashboard')
    args.push(dashboardRepo)
  }
  return () => {
    try {
      execFileSync(file, args, options)
    } catch(e) {
      console.error(e)
    }
  }
}

function invokeCypressCommand(baseArgs, forwardedEnv) {
  const args = ['run', 'cypress', ...baseArgs]
  const options = {stdio: 'inherit', env: {...process.env, ...forwardedEnv}}
  return spawnSync.bind(null, 'yarn', args, options)
}

async function main() {
  const args = require('minimist')(process.argv.slice(2))
  let prepareUserCommand

  let {username, awsAuthMethod, cypressEnv, dashboardRepo, REPOS_NAMESPACE} = readArgs(args)

  if(!REPOS_NAMESPACE) REPOS_NAMESPACE = 'testing'

  if(!username) {
    // we need to create a new user
    username = identifierFromCurrentTime('user')
    prepareUserCommand = createDashboardCommand(username, dashboardRepo)

    console.log(`Created user ${username}`)
  }

  const GCP_ENVIRONMENT_NAME = identifierFromCurrentTime('gcp').toLowerCase()
  const AWS_ENVIRONMENT_NAME = identifierFromCurrentTime('aws').toLowerCase()

  const forwardedEnv = forwardedEnvironmentVariables({OC_IMPERSONATE: username, AWS_ENVIRONMENT_NAME, GCP_ENVIRONMENT_NAME, REPOS_NAMESPACE})

  const cypressCommand = invokeCypressCommand(args._, forwardedEnv)

  if(prepareUserCommand) prepareUserCommand()
  cypressCommand()
}

async function tryMain() {
  try {
    await main()
  } catch(e) {
    console.error('Error:', e.message)
  }
}

tryMain()
