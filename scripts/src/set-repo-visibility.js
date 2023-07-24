#!/usr/bin/env node

const {extractCsrf} = require("./shared/util.js")
const axios = require('./shared/axios-instance.js')
const FormData = require('form-data')
const login = require('./shared/login.js')

async function setRepoVisibility(projectPath, visibility) {
  const _visibility = visibility == 'public'? 20 : visibility == 'internal'? 10 : 0
  await login()
  const res = await axios.get(`${process.env.OC_URL}/${projectPath}/edit`)
  const authenticity_token = extractCsrf(res.data)

  const form = new FormData()
  form.append('_method', 'patch')
  form.append('project[visibility_level]', _visibility)
  form.append('authenticity_token', authenticity_token)

  const headers = {
    ...form.getHeaders(),
    "Content-Length": form.getLengthSync()
  }

  const status = (await axios.post(`${process.env.OC_URL}/${projectPath}`, form, {headers})).status

  return status < 400 && status >= 200
}

module.exports = setRepoVisibility

if(require.main === module) {
  try {
    main()
  } catch(e) {
    console.error(e.message)
    process.exit(1)
  }
}
async function main () {
  const args = require('minimist')(process.argv.slice(2))
  const visibility = args.visibility || args._[0] || 'private'
  if (!['public', 'private', 'internal'].includes(visibility)) {
    throw new Error(`"--visibility" public|private|internal, got: ${visibility}`)
  }
  const projectPath = args.projectPath || args['project-path']
  if (!projectPath) {
    throw new Error('expected --project-path to be set')
  }

  if(! await setRepoVisibility(projectPath, visibility)) {
    throw new Error(`An error occurred while attempting to set the visibility of ${projectPath}`)
  }
}
