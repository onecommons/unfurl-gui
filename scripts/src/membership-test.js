#!/usr/bin/env node

const os = require('os')
const fs = require('fs')
const path = require('path')
const tar = require('tar')
const axios = require('./shared/axios-instance.js')
const login = require('./shared/login.js')

const createUser = require('./create-user')
const pushLocalRepo = require('./push-local-repo')
const addProjectMember = require('./add-project-member')
const createProjectToken = require('./create-project-token')
const {extractCsrf} = require("./shared/util.js")

const tmpdirName = path.join('/', os.tmpdir(), `unfurl-gui-${Date.now()}`)

console.log({tmpdirName})



async function main() {
  await login()
  const fixtures = ['buildpack-test-app.tar', 'container-webapp.tar', 'dashboard.tar']

  const tarPromises = fixtures.map(f => 
    tar.x({
      file: path.join(__dirname, 'membership-test', f),
      C: tmpdirName
    })
  )

  await Promise.all(tarPromises)

  const now = Date.now().toString(36).slice(-6)
  const upstreamUsername = `user-up-${now}`
  const downstreamUsername = `user-down-${now}`

  const upstreamCodeRepo = `${process.env.OC_URL}/${upstreamUsername}/buildpack-test-app`
  const upstreamBlueprint = `${process.env.OC_URL}/${upstreamUsername}/container-webapp`
  const deployToken = 'foo'
  const dashboardProject = `${downstreamUsername}/dashboard`

  // tmp until we test these users
  try {
    console.log(`Creating ${upstreamUsername}`)
    await createUser({username: upstreamUsername})
    console.log(`Creating ${downstreamUsername}`)
    await createUser({username: downstreamUsername})
  } catch(e){console.error(e)}

  try {
    await pushLocalRepo(
      path.join(tmpdirName, 'buildpack-test-app'),
      `${upstreamUsername}/buildpack-test-app`,
      {branch: 'master'}
    )
    await pushLocalRepo(
      path.join(tmpdirName, 'container-webapp'),
      `${upstreamUsername}/container-webapp`,
      {branch: 'main'}
    )
  } catch(e){console.error(e)}
  
  try {
    await pushLocalRepo(
      path.join(tmpdirName, 'dashboard'),
      `${downstreamUsername}/dashboard`,
      {branch: 'main'}
    )
  } catch(e) {console.error(e)}

  await createProjectToken({project: dashboardProject})
  
  const res = await axios.get(`${process.env.OC_URL}/api/v4/projects/${encodeURIComponent(dashboardProject)}/members`)
  const bot_id = res.data.find(member => member.name == 'UNFURL_PROJECT_TOKEN').id


  try {
    await addProjectMember({accessLevel: 30, username: downstreamUsername, project: `${upstreamUsername}/container-webapp`})
    await addProjectMember({accessLevel: 30, username: downstreamUsername, project: `${upstreamUsername}/buildpack-test-app`})
  } catch(e) {
    console.error(e)
  }


  const variables = {
    WORKFLOW: 'deploy',
    DEPLOY_ENVIRONMENT: 'gcp',
    BLUEPRINT_PROJECT_URL: `${upstreamBlueprint}.git`,
    DEPLOYMENT: 'membership-test',
    DEPLOY_PATH: 'environments/gcp/nov4testb/container-webapp/membership-test',
    PROJECT_DNS_ZONE: `${downstreamUsername}.u.opencloudservices.net`
  }

  const apiTarget = `${process.env.OC_URL}/${downstreamUsername}/dashboard/-/deployments/new`

  const requestBody = {
    pipeline: {
      ref: 'main',
      variables_attributes: Object.entries(variables).map(([key, secret_value]) => ({key, secret_value, masked: false, variable_type: 'unencrypted_var'})),
    },
    deployment: {
      bot_id,
      schedule: 'now',
      project_dependencies: {
        [`${upstreamUsername}/container-webapp`]: '_dep_foo',
        [`${upstreamUsername}/buildpack-test-app`]: '_dep_bar',
      }
    }
  }


  console.log(`POST ${apiTarget}`)
  console.log(requestBody)

  await login(null, null, null, downstreamUsername, true)


  const page = (await axios.get(apiTarget.replace('/new', ''))).data
  const authenticity_token = extractCsrf(page)

  const {status, data} = await axios.post(
    apiTarget,
    requestBody,
    {
      headers: {
        'X-CSRF-Token': authenticity_token
      }
    }
  )

  console.log({data, status})
  if(status >= 200 && status <= 400) {} 
  else {
    throw new Error(`Membership test failed: pipeline returned ${status}`)
  }


}


async function tryMain() {
  try {
    fs.mkdirSync(tmpdirName)
    await main()
    fs.rmdirSync(tmpdirName, {recursive: true})
  } catch(e) {
    console.error(e)
    process.exit(1)
  }
}


tryMain()

