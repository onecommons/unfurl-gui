#!/usr/bin/env node

const {extractCsrf} = require("./shared/util.js")
const axios = require('./shared/axios-instance.js')
const FormData = require('form-data')
const login = require('./shared/login.js')

async function addProjectMember(o) {
  const {username, project, accessLevel} = o
  await login()


  const matchingUsers = (await axios.get(`${process.env.UNFURL_CLOUD_SERVER || process.env.OC_URL}/-/autocomplete/users.json?search=${username}`)).data

  const user_id = `${matchingUsers.find(u => u.username == username).id}` // ffs gitlab

  const url = `${process.env.UNFURL_CLOUD_SERVER || process.env.OC_URL}/${project}/-/project_members`
  const page = (await axios.get(url)).data
  const authenticity_token = extractCsrf(page)


  const invitationUrl = `${process.env.UNFURL_CLOUD_SERVER || process.env.OC_URL}/api/v4/projects/${encodeURIComponent(project)}/invitations`
  const body = {
      user_id,
      format: 'json',
      invite_source: 'project-members-page',
      tasks_project_id: '',
      tasks_to_be_done: [],
      access_level: accessLevel || 30
  }

  const response = await axios.post(
    invitationUrl, body,
    {
      headers: {
        'X-CSRF-Token': authenticity_token
      }
    }
  )

  const status = response.status

  if(status < 400 && status >= 200) { return true }
  else {
    // console.error(response)
    throw new Error(`Could not add ${username} to ${project}`)
  }
}

async function main() {
  const args = require('minimist')(process.argv.slice(2))
  await addProjectMember({
    accesslevel: args['access-level'] || 30,
    project: args['project-path'] || args['project'],
    ...args
  })
}

async function tryMain() {
  try {
    await main()
  } catch(e) {
    console.error(e.message)
  }
}

if(require.main == module) {
  tryMain()
}

module.exports = addProjectMember
