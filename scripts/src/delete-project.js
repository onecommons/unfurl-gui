#!/usr/bin/env node

const {extractCsrf} = require("./shared/util.js")
const axios = require('./shared/axios-instance.js')
const FormData = require('form-data')
const login = require('./shared/login.js')

async function deleteProject(projectPath) {
  await login()
  const res = await axios.get(`${process.env.OC_URL}/admin/projects`)
  const authenticity_token = extractCsrf(res.data)

  const form = new FormData()
  form.append('authenticity_token', authenticity_token)
  form.append('_method', 'delete')
  const projectName = projectPath.split('/').pop()
  form.append('projectName', projectName)

  const headers = {
    ...form.getHeaders(),
    "Content-Length": form.getLengthSync()
  }

  const status = (await axios.post(`${process.env.OC_URL}/admin/projects/${projectPath}`, form, {headers})).status

  console.log(status)
  return status < 400 && status >= 200
}

module.exports = deleteProject

if(require.main === module) {
  try {
    main()
  } catch(e) {
    console.error(e.message)
    process.exit(1)
  }
}

async function main() {
  const args = require('minimist')(process.argv.slice(2))
  const [projectPath] = args._
  if(! await deleteProject(projectPath)) {
    throw new Error('Error occurred trying to delete project')
  }
}
