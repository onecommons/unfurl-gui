#!/usr/bin/env node
const expect = require('expect')
const {GITHUB_ACCESS_TOKEN, GITHUB_USERNAME} = process.env
const path = require('path')
const fs = require('fs')
const os = require('os')
const {execSync} = require('child_process')
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0
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
  rejectUnauthorized: false,
})


async function main({repository, identifier, liveURL}) {
  execSync(`./no-http-error.js --base-url ${liveURL}`, {stdio: 'inherit', cwd: __dirname})
  
  const tmpDir = path.join(os.tmpdir(), identifier)
  console.log({repository, identifier, liveURL, tmpDir})

  /*
  try {
    fs.rmSync(tmpDir, {recursive: true, force: true})
  } catch(e) {}
  */
  try {
    fs.mkdirSync(tmpDir)
  } catch(e) {}

  try{
    execSync(`git clone https://${GITHUB_USERNAME}:${GITHUB_ACCESS_TOKEN}@github.com/${GITHUB_USERNAME}/${repository}`, {stdio: 'inherit', cwd: tmpDir})
  } catch(e){ console.error('e')}

  const indexView = path.join(tmpDir, repository, 'views', 'index.pug')

  let fileContents = fs.readFileSync(indexView, {encoding: 'utf-8'})
  fileContents = fileContents.split('\n')

  fileContents.pop()
  fileContents.push(`  p ${identifier}`)

  fileContents = fileContents.join('\n')

  fs.writeFileSync(indexView, fileContents)

  try {
    execSync(`git commit -am ${identifier} && git push`, {stdio: 'inherit', cwd: path.join(tmpDir, repository)})
  } catch(e) {}


  // TODO verify incremental deployment here

  const index = (await(axios.get(liveURL))).data
  console.log(index)
  expect(index).toContain(identifier)
}

async function tryMain() {
  const args = require('minimist')(process.argv.slice(2))

  try {
    await main({
      liveURL: args['live-url'] || args['base-url'],
      repository: args['repository'] || args['repo'],
      identifier: args['identifier'] || args['id'],
      ...args
    })
  } catch(e) {
    if(e.code) {
      console.error(e.code)
      console.error(e.message)
      process.exit(1)
    } else {
      console.log(e)
      console.log('Container webapp tests failed')
      process.exit(1)
    }
  }
}
tryMain()

