#!/usr/bin/env node

const {extractCsrf} = require("./shared/util.js")
const axios = require('./shared/axios-instance.js')
const login = require('./shared/login.js')

async function clearProjectCache({projectPath}) {
  await login()
  console.log(`${process.env.OC_URL}/services/unfurl-server/clear_project_file_cache?auth_project=${encodeURIComponent(projectPath)}`)
  return await axios.post(`${process.env.OC_URL}/services/unfurl-server/clear_project_file_cache?auth_project=${encodeURIComponent(projectPath)}`)
}


async function main() {
  const args = require('minimist')(process.argv.slice(2))

  const response = await clearProjectCache({
    projectPath: args['project-path'],
    ...args
  })

  if(response.status >= 400) {
    throw new Error(`Got an error reponse - ${JSON.stringify(response.data)}`)
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

