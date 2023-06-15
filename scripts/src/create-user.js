#!/usr/bin/env node

const OC_USERNAME = process.env.OC_USERNAME
const OC_PASSWORD = process.env.OC_PASSWORD
const {spawnSync} = require('child_process')

const {extractCsrf} = require("./shared/util.js")
const axios = require('./shared/axios-instance.js')
const FormData = require('form-data')
const login = require('./shared/login.js')
const pushLocalRepo = require('./push-local-repo.js')

async function createUserAsAdmin(o) {
  if(!o) throw new Error('expected options to create new user')
  await login()
  const res = await axios.get(`${process.env.OC_URL}/admin/users/new`)
  const authenticity_token = extractCsrf(res.data)
  const options = {
    name: o.name || o.username,
    username: o.username || o.name,
    projects_limit: 100000,
    can_create_group: 0,
    access_level: 'reqular',
    external: o.external? 1: 0,
    'credit_card_validation_attributes][credit_card_validated_at': 0,
  }
  options.email = o.email || `${options.username}@unfurl.cloud`
  const form = new FormData()
  Object.entries(options).forEach(([key, value]) => {
    form.append(`user[${key}]`, value)
  })
  form.append('authenticity_token', authenticity_token)

  const headers = {
    ...form.getHeaders(),
    "Content-Length": form.getLengthSync()
  }

  const status = (await axios.post(`${process.env.OC_URL}/admin/users`, form, {headers})).status

  return status < 400 && status >= 200
}

async function createUserBySignup(o) {
  const selectRole = o.hasOwnProperty('select_role') || o.hasOwnProperty('select-role')
  const inviteCode = o.invite_code || o['invite-code']

  {
    const signinPage = await axios.get(`${process.env.OC_URL}/users/sign_in`)
    const authenticity_token = extractCsrf(signinPage.data)

    const form = new FormData()
    form.append('authenticity_token', authenticity_token)
    form.append('new_user[invite_code]', inviteCode || '')
    form.append('firstname', '')
    form.append('new_user[first_name]', o.username || o.name)
    form.append('new_user[last_name]', '')
    form.append('new_user[username]', o.username || o.name)
    form.append('new_user[email]', `${o.username || o.name}@unfurl.cloud`)
    form.append('new_user[password]', o.password)

    const headers = {
      ...form.getHeaders(),
      "Content-Length": form.getLengthSync()
    }

    const response = (await axios.post(`${process.env.OC_URL}/users`, form, {headers}))
    if(response.status > 400) {
      console.error(response.data)
      return false
    }
  }

  if(selectRole){
    const welcomePage = await axios.get(`${process.env.OC_URL}/users/sign_up/welcome`)
    const authenticity_token = extractCsrf(welcomePage.data)

    const external = o.external

    const form = new FormData()

    form.append('_method', 'patch')
    form.append('authenticity_token', authenticity_token)
    form.append('user[invite_code]', inviteCode || '')
    form.append('user[role]', external? 'other': 'software_developer')

    const headers = {
      ...form.getHeaders(),
      "Content-Length": form.getLengthSync()
    }

    const response = (await axios.post(`${process.env.OC_URL}/users/sign_up/welcome`, form, {headers}))
    if(response.status > 400) {
      console.error(response.data)
      return false
    }
  }

  return true
}

module.exports = createUserAsAdmin



async function main() {
  const args = require('minimist')(process.argv.slice(2))
  console.log('Creating user...')
  let createUserFunc = OC_USERNAME && OC_PASSWORD? createUserAsAdmin: createUserBySignup
  if(! await createUserFunc(args)) {
    throw new Error('Failed to create user')
  }

  let external = args.hasOwnProperty('external') ? args.external : 1
  if(external === undefined) {
    external = 1
  }

  args.external = external

  let dashboard
  if(dashboard = args['create-dashboard'] || args.dashboard) {
    const username = args.name || args.username
    console.log(`Creating a dashboard at ${username}/dashboard`)
    const options = {}
    if(!(OC_USERNAME && OC_PASSWORD)) {
      options.username = username
      options.password = args.password
    }

    spawnSync('sleep', ['1'])

    if(! pushLocalRepo(dashboard, `${username}/dashboard`, options)) {
      throw new Error('Failed to push local repo to dashboard')
    }
  }
}

async function tryMain() {
  try {
    await main()
  } catch(e) {
    console.error(e.message)
    process.exit(1)
  }
}

if(require.main === module) {
  tryMain()
}
