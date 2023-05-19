#!/usr/bin/env node
const expect = require('expect')

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

async function main({baseURL, registerName, registerEmail, registerPassword}) {
  const signupEndpoint = `${baseURL}/api/user/`

  const initialRequest = await axios.get(baseURL)
  expect(initialRequest.status).toBeLessThan(400)

  const signupPayload = {
    name: registerName || "John Denne",
    email: registerEmail,
    password: registerPassword,
    authenticate:true,
    language:"en"
  }

  const signupPost = await axios.post(signupEndpoint, signupPayload)
  expect(signupPost.status).toBeLessThan(400)

  console.log('Baserow tests passed')
}

async function tryMain() {
  const args = require('minimist')(process.argv.slice(2))

  try {
    await main({
      baseURL: args['base-url'],
      registerName: args['register-name'],
      registerEmail: args['register-email'],
      registerPassword: args['register-password'],
      ...args
    })
  } catch(e) {
    if(e.code) {
      console.error(e.code)
      //console.error(e)
      process.exit(1)
    } else {
      console.log(e)
      console.log('Baserow tests failed')
      process.exit(1)
    }
  }
}
tryMain()

