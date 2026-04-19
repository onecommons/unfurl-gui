#!/usr/bin/env node

const OC_USERNAME = process.env.OC_USERNAME
const OC_PASSWORD = process.env.OC_PASSWORD
const UNFURL_CLOUD_SERVER = process.env.UNFURL_CLOUD_SERVER || process.env.OC_URL
const UNFURL_CMD = process.env.UNFURL_CMD || 'unfurl'

const {spawnSync} = require('child_process')

const axios = require('./shared/axios-instance.js')
const login = require('./shared/login.js')
const createProjectAccessToken = require('./create-project-token')
const createProjectToken = require('./create-project-token')


async function main() {
  const args = require('minimist')(process.argv.slice(2))

  const username = args.user || args.username || OC_USERNAME

  const didLogin = await login(
    UNFURL_CLOUD_SERVER,
    username,
    args.password || OC_PASSWORD,
  )
  if(!didLogin) {
    throw new Error('Failed to log in')
  }

  // const response = await axios.post(`${UNFURL_CLOUD_SERVER}/api/v4/projects/${username}%2Fdashboard/access_tokens`, {
  //   name: 'TestProjectAccessToken',
  //   scopes: ['api', 'read_api', 'read_registry', 'write_registry', 'read_repository', 'write_repository'],
  //   id: `${username}%2Fdashboard`
  // })

  // if(response.status >= 400) {
  //   throw new Error(`Access token: ${response.status}: ${response.statusText}`)
  // }

  // const {token} = (response)?.data
  const token = await createProjectToken({project: `${username}/dashboard`})

  const dashboardUrl = new URL(UNFURL_CLOUD_SERVER)
  dashboardUrl.username = username
  dashboardUrl.password = token
  dashboardUrl.pathname = `${username}/dashboard`

  const unfurlArgs = [
    'clone',
    dashboardUrl.toString(),
    '--var',
    'UNFURL_CLOUD_VARS_URL',
    `${UNFURL_CLOUD_SERVER}/api/v4/projects/${username}%2Fdashboard/variables?per_page=1000&private_token=${token}`,
    ...args._
  ]

  
  console.log("running", UNFURL_CMD, unfurlArgs.join(' ').replaceAll(token, "XXXXX"))
  spawnSync(UNFURL_CMD, unfurlArgs, {stdio: 'inherit'})
}

async function tryMain() {
  try { await main()
  } catch(e) {
    console.error(e.message)
    process.exit(1)
  }
}

if(require.main === module) {
  tryMain()
}
