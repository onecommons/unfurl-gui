#!/usr/bin/env node

const {extractCsrf} = require("./shared/util.js")
const axios = require('./shared/axios-instance.js')
const FormData = require('form-data')
const login = require('./shared/login.js')

async function addProjectMember(o) {
  const {username, project, accessLevel} = o
  await login()

  const matchingUsers = (await axios.get(`${process.env.OC_URL}/-/autocomplete/users.json?search=${username}`)).data

  const user_id = matchingUsers.find(u => u.username == username).id

  const url = `${process.env.OC_URL}/${project}/-/project_members`
  const page = (await axios.get(url)).data
  const authenticity_token = extractCsrf(page)

  let response, status 
  if(true) {
  // I think this always works?
  //if(process.env.GITLAB_VERSION == '14.9') {
    response = await axios.post(
      `${process.env.OC_URL}/api/v4/projects/${encodeURIComponent(project)}/members`,
      {
        user_id,
        access_level: accessLevel || 30 
      },
      {
        headers: {
          'X-CSRF-Token': authenticity_token
        }
      }
    )
  }
  else {
    const form = new FormData()

    form.append('authenticity_token', authenticity_token)
    form.append('user_ids', user_id)
    form.append('access_level', accessLevel || 30)

    const headers = {
      ...form.getHeaders(),
      "Content-Length": form.getLengthSync()
    }

    const response = (await axios.post(url, form, {headers}))
    const {status} = response
  }

  status = response.status

  if(status < 400 && status >= 200) { return true }
  else {
    console.error(response)
    throw new Error(`Could not add ${username} to ${project}`)
  }
} 

async function main() {
  const args = require('minimist')(process.argv.slice(2))
  await addProjectMember({
    accesslevel: args['access-level'] || 30,
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
