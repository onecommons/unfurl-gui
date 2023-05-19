#!/usr/bin/env node
const expect = require('expect')
const assert = require('assert')

const {HttpsCookieAgent} = require('http-cookie-agent')
const axios = require('axios')
axios.defaults.withCredentials = true
axios.defaults.timeout = 40000
const validateStatus = axios.defaults.validateStatus = () => true
const { CookieJar } = require('tough-cookie')
const jar = new CookieJar()

axios.defaults.httpsAgent = new HttpsCookieAgent({
  jar,
  keepAlive: true,
})

async function isSetup(baseURL) {
  const data = (await axios.get(`${baseURL}/ghost/api/admin/authentication/setup/`)).data
  return data.setup.find(el => el.hasOwnProperty('status')).status
} 

async function main({baseURL, useAdminEmail, useAdminPassword, registerEmail, registerName, expectExisting}) {
  const adminSessionEndpoint = `${baseURL}/ghost/api/admin/session`
  const authSetupEndpoint = `${baseURL}/ghost/api/admin/authentication/setup/`
  const userRolesEndpoint = `${baseURL}/ghost/api/admin/users/me/?include=roles`
  const magicLinkEndpoint = `${baseURL}/members/api/send-magic-link/`

  const initialRequest = await axios.get(baseURL)
  expect(initialRequest.status).toBeLessThan(400)

  if(useAdminEmail && useAdminPassword) {
    if(await isSetup(baseURL)) {
      const adminSessionPost = await axios.post(adminSessionEndpoint, {username: useAdminEmail, password: useAdminPassword})
      assert.equal(adminSessionPost.data, 'Created', adminSessionPost.data)
    }
    else {
      assert(!expectExisting, 'expected existing admin user')
      const setupPayload = {setup: [
        {blogTitle: 'Test Blog', email: useAdminEmail, name: 'John Denne', password: useAdminPassword}
      ]}
      const setupPost = await axios.post(authSetupEndpoint, setupPayload)
      assert.equal(setupPayload.data, 'Created', setupPayload.data)

      assert.ok(await isSetup(baseURL), 'Setup should be completed')
    }
    
    const userRolesFetch = await axios.get(userRolesEndpoint)
    assert.equal(userRolesFetch.data.errors, undefined, JSON.stringify(userRolesFetch.data.errors, null, 2))
  } 

  /*
   * reenable this when mailu is working again
  if(registerEmail && registerName) {
    const magicLinkPost = await axios.post(magicLinkEndpoint, {name: registerName, email: registerEmail, requestSrc: 'portal'})
    assert(magicLinkPost.status < 400, JSON.stringify(magicLinkPost.data, null, 2))
  }
  */


  console.log('Ghost tests passed')
}

async function tryMain() {
  const args = require('minimist')(process.argv.slice(2))

  try {
    await main({
      baseURL: args['base-url'],
      registerName: args['register-name'],
      registerEmail: args['register-email'],
      useAdminEmail: args['admin-email'],
      useAdminPassword: args['admin-password'],
      expectExisting: args['expect-existing'],
      ...args
    })
  } catch(e) {
    if(e.code && e.code != 'ERR_ASSERTION') {
      console.error(e.code)
      //console.error(e)
      process.exit(1)
    } else {
      console.error(e)
      console.log('Ghost tests failed')
      process.exit(1)
    }
  }
}
tryMain()

