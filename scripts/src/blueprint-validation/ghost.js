#!/usr/bin/env node
const expect = require('expect')
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0
const {HttpsCookieAgent} = require('http-cookie-agent')
const axios = require('axios')
axios.defaults.withCredentials = true
const validateStatus = axios.defaults.validateStatus = () => true
const { CookieJar } = require('tough-cookie')
const jar = new CookieJar()

axios.defaults.httpsAgent = new HttpsCookieAgent({
  jar,
  keepAlive: true,
  rejectUnauthorized: false,
})

async function main({baseURL, username, password}) {
  const adminSessionEndpoint = `${baseURL}/ghost/api/admin/session`
  const userRolesEndpoint = `${baseURL}/ghost/api/admin/users/me/?include=roles`

  const adminSessionPost = await axios.post(adminSessionEndpoint, {username, password})

  expect(adminSessionPost.data).toBe('Created')

  const userRolesFetch = await axios.get(userRolesEndpoint, {validateStatus})

  expect(userRolesFetch.data.errors).toBeUndefined()

  console.log('Ghost tests passed')
}

async function tryMain() {
  const args = require('minimist')(process.argv.slice(2))

  try {
    await main({
      baseURL: args['base-url'],
      ...args
    })
  } catch(e) {
    if(e.code) {
      console.error(e.code)
      process.exit(1)
    } else {
      console.log(e)
      console.log('Ghost tests failed')
      process.exit(1)
    }
  }
}
tryMain()

