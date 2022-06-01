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

async function isSetup(baseURL) {
  const data = (await axios.get(`${baseURL}/ghost/api/admin/authentication/setup/`)).data
  return data.setup.find(el => el.hasOwnProperty('status')).status
} 

async function main({baseURL, useAdminEmail, useAdminPassword, registerEmail, registerName}) {
  const adminSessionEndpoint = `${baseURL}/ghost/api/admin/session`
  const authSetupEndpoint = `${baseURL}/ghost/api/admin/authentication/setup/`
  const userRolesEndpoint = `${baseURL}/ghost/api/admin/users/me/?include=roles`
  const magicLinkEndpoint = `${baseURL}/members/api/send-magic-link/`



  const initialRequest = await axios.get(baseURL)
  expect(initialRequest.status).toBeLessThan(400)

  if(useAdminEmail && useAdminPassword) {
    if(await isSetup(baseURL)) {
      const adminSessionPost = await axios.post(adminSessionEndpoint, {username: useAdminEmail, password: useAdminPassword})
      expect(adminSessionPost.data).toBe('Created')
    }
    else {
      const setupPayload = {setup: [
        {blogTitle: 'Test Blog', email: useAdminEmail, name: 'John Denne', password: useAdminPassword}
      ]}
      const setupPost = await axios.post(authSetupEndpoint, setupPayload)
      expect(setupPayload.data).toBe('Created')

      expect(await isSetup(baseURL)).toBe(true)
    }
    


    const userRolesFetch = await axios.get(userRolesEndpoint)

    expect(userRolesFetch.data.errors).toBeUndefined()

  } 

  if(registerEmail && registerName) {
    const magicLinkPost = await axios.post(magicLinkEndpoint, {name: registerName, email: registerEmail, requestSrc: 'portal'})
    expect(magicLinkPost.status).toBeLessThan(400)
  }
  //https://www.untrusted.me/
  //{"name":"Andrew","email":"breidenbach.aj@gmail.com","requestSrc":"portal"}


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
      ...args
    })
  } catch(e) {
    if(e.code) {
      console.error(e.code)
      //console.error(e)
      process.exit(1)
    } else {
      console.log(e)
      console.log('Ghost tests failed')
      process.exit(1)
    }
  }
}
tryMain()

