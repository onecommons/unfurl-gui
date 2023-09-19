#!/usr/bin/env node
const {expect} = require('expect')

const FormData = require('form-data')
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

async function main({baseURL, registerName, registerPassword, expectExisting}) {
  const signupEndpoint = `${baseURL}/index.php`
  const loginEndpoint = `${baseURL}/login`

  const initialRequest = await axios.get(baseURL)
  expect(initialRequest.status).toBeLessThan(400)

  if(initialRequest.data.match(/Create.*admin account/g)) {
    expect(expectExisting).toBeFalsy()
    expect(initialRequest.data).not.toMatch(/Configure the database/g)
    const form = new FormData()
    form.append('install', 'true')
    form.append('adminlogin', registerName)
    form.append('adminpass', registerPassword)
    form.append('adminpass-clone', registerPassword)
    const headers = {
      ...form.getHeaders(),
      "Content-Length": form.getLengthSync()
    }
    const signupPost = await axios.post(signupEndpoint, form, {headers})
    expect(signupPost.status).toBeLessThan(400)
  } else {
    const token = (/data-requesttoken="(?<token>.*)"/g).exec(initialRequest.data).groups.token
    const form = new FormData()
    form.append('user', registerName)
    form.append('password', registerPassword)
    form.append('timezone', 'Europe/Belgrade')
    form.append('timezone_offset', '2')
    form.append('requesttoken', token)
    const headers = {
      ...form.getHeaders(),
      "Content-Length": form.getLengthSync()
    }
    const loginPost = await axios.post(loginEndpoint, form, {headers})
    expect(loginPost.status).toBeLessThan(400)
  }

  console.log('Nextcloud tests passed')
}

async function tryMain() {
  const args = require('minimist')(process.argv.slice(2))

  try {
    await main({
      baseURL: args['base-url'],
      registerName: args['register-name'],
      registerPassword: args['register-password'],
      expectExisting: args['expect-existing'],
      ...args
    })
  } catch(e) {
    if(e.code) {
      console.error(e.code)
      //console.error(e)
      process.exit(1)
    } else {
      console.log(e.message)
      console.log('Nextcloud tests failed')
      process.exit(1)
    }
  }
}
tryMain()
