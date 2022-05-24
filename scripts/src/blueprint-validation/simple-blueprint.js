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

async function main({publicAddress}) {
  const response = await axios.get(publicAddress)
  expect(response.status).toBe(200)
}

async function tryMain() {
  const args = require('minimist')(process.argv.slice(2))

  try {
    await main({
      publicAddress: args['public-address'],
      ...args
    })
  } catch(e) {
    if(e.code) {
      console.error(e.code)
      process.exit(1)
    } else {
      console.log(e)
      console.log('simple blueprint tests failed')
      process.exit(1)
    }
  }
}
tryMain()