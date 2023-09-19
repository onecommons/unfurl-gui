#!/usr/bin/env node
const {expect} = require('expect')

const {HttpsCookieAgent} = require('http-cookie-agent')
const axios = require('axios')
axios.defaults.timeout = 40000
axios.defaults.withCredentials = true
const validateStatus = axios.defaults.validateStatus = () => true
const { CookieJar } = require('tough-cookie')
const jar = new CookieJar()

axios.defaults.httpsAgent = new HttpsCookieAgent({
  jar,
  keepAlive: true,
})

async function main({baseURL, useAdminEmail, useAdminPassword, registerEmail, registerName}) {
  const initialRequest = await axios.get(baseURL)
  expect(initialRequest.status).toBeLessThan(400)

  console.log(`Received ${initialRequest.status}`)
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
      //console.error(e)
      process.exit(1)
    } else {
      console.log(e)
      console.log('Did not receive an error code less than 400')
      process.exit(1)
    }
  }
}
tryMain()

