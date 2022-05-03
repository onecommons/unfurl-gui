#!/usr/bin/env node

const {extractCsrf} = require("./shared/util.js")
const axios = require('./shared/axios-instance.js')
const FormData = require('form-data')
const login = require('./shared/login.js')
const pushLocalRepo = require('./push-local-repo.js')

async function createUser(o) {
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
    external: 0,
    'credit_card_validation_attributes][credit_card_validated_at': 0
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

module.exports = createUser

if(require.main === module) {
  try {
    main()
  } catch(e) {
    console.error(e.message)
    process.exit(1)
  }
}

async function main() {
  const args = require('minimist')(process.argv.slice(2))
  console.log('Creating user...')
  if(! await createUser(args)) {
    throw new Error('Failed to create user')
  }
  let dashboard
  if(dashboard = args['create-dashboard'] || args.dashboard) {
    const username = args.name || args.username
    console.log(`Creating a dashboard at ${username}/dashboard`)
    if(! pushLocalRepo(dashboard, `${username}/dashboard`)) {
      throw new Error('Failed to push local repo to dashboard')
    }
  }
}
