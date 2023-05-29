#!/usr/bin/env node


const {execFileSync, spawnSync} = require('child_process')
const path = require('path')
const fs = require('fs')
const {unfurlGuiRoot} = require('./shared/util.js')

const READ_ARGS = {
  username: (args) => args.u || args.username,
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


const ENVIORONMENT_VARIABLE_TRANSFORMATIONS = {
  'GOOGLE_APPLICATION_CREDENTIALS': (value) => {
    let dest = path.join('tmp', path.basename(value))
    
    // ci drops .json extension needed for fixtures
    if(!dest.endsWith('.json')) {
      dest = `${dest}.json`
    }
    fs.copyFileSync(value, path.join(unfurlGuiRoot, 'cypress/fixtures', dest))
    return dest
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
  'OC_IMPERSONATE', 'DO_ENVIRONMENT_NAME', 'AWS_ENVIRONMENT_NAME', 'GCP_ENVIRONMENT_NAME', 'AZ_ENVIRONMENT_NAME', // always overriden
]
const FORWARD_ENVIRONMENT_VARIABLES = [
  ...JSON.parse(fs.readFileSync(path.join(__dirname, 'forwarded-variables.json'), 'utf-8')),
  ...INTERNAL_TEST_VARIALBES
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
  return `${baseId}-${d.toISOString().replace(/(:|\.|-)/g, '')}`
}

function createDashboardCommand(username, dashboardRepo) {
  //if(!dashboardRepo) { throw new Error(ERROR_CREATE_USER_NO_DASHBOARD) }
  const 
    file = path.join(__dirname, 'create-user.js'),
    args = ['--username', username, '--external', process.env['EXTERNAL'] || '1'],
    options = {stdio: 'inherit'}
  if(dashboardRepo) {
    args.push('--dashboard')
    args.push(dashboardRepo)
  }
  return () => {
    try {
      execFileSync(file, args, options)
    } catch(e) {
      console.error(e.message)
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

  const parsedArgs = readArgs(args)
  let {username, awsAuthMethod, cypressEnv, dashboardRepo, REPOS_NAMESPACE, group} = parsedArgs

  if(!REPOS_NAMESPACE) REPOS_NAMESPACE = 'testing'

  if(!username) {
    // we need to create a new user
    username = identifierFromCurrentTime('user')
    prepareUserCommand = createDashboardCommand(username, dashboardRepo)


    console.log(`Created user ${username}`)  
  }

  console.log(`${process.env.OC_URL}/${username}/dashboard/-/deployments`)

  const GCP_ENVIRONMENT_NAME = identifierFromCurrentTime('gcp').toLowerCase()
  const AWS_ENVIRONMENT_NAME = identifierFromCurrentTime('aws').toLowerCase()
  const DO_ENVIRONMENT_NAME = identifierFromCurrentTime('do').toLowerCase()
  const K8S_ENVIRONMENT_NAME = identifierFromCurrentTime('k8s').toLowerCase()
  const AZ_ENVIRONMENT_NAME = identifierFromCurrentTime('az').toLowerCase()
  const INTEGRATION_TEST_ARGS = JSON.stringify(parsedArgs)

  let env = {OC_IMPERSONATE: username, AWS_ENVIRONMENT_NAME, GCP_ENVIRONMENT_NAME, DO_ENVIRONMENT_NAME, K8S_ENVIRONMENT_NAME, AZ_ENVIRONMENT_NAME, REPOS_NAMESPACE, INTEGRATION_TEST_ARGS}

  if(group) {
    env.DEFAULT_NAMESPACE = group
  }

  const forwardedEnv = forwardedEnvironmentVariables(env)

  const cypressCommand = invokeCypressCommand(args._, forwardedEnv)

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


  const cypressResult = cypressCommand()
  console.log(cypressResult)
  const status = cypressResult.status
  if(status) {
    process.exit(status)
  }
}

async function tryMain() {
  try {
    await main()
  } catch(e) {
    console.error('Error:', e.message)
  }
}

tryMain()
