const {extractCsrf} = require("./shared/util.js")
const axios = require('./shared/axios-instance.js')
const FormData = require('form-data')
const login = require('./shared/login.js')

async function createProjectToken(o) {
  const {project, accessLevel} = o
  await login()

  const url = `${process.env.OC_URL}/${project}/-/settings/access_tokens`
  const page = (await axios.get(url)).data
  const authenticity_token = extractCsrf(page)

  const form = new FormData()

  form.append('authenticity_token', authenticity_token)
  form.append('project_access_token[name]', 'UNFURL_PROJECT_TOKEN')
  form.append('project_access_token[access_level]', accessLevel || 40)
  form.append('project_access_token[expires_at]', '')
  form.append('project_access_token[scopes][]', 'api')
  form.append('project_access_token[scopes][]', 'read_api')
  form.append('project_access_token[scopes][]', 'read_repository')
  form.append('project_access_token[scopes][]', 'write_repository')
  form.append('project_access_token[scopes][]', 'read_registry')
  form.append('project_access_token[scopes][]', 'write_registry')

  const headers = {
    ...form.getHeaders(),
    "Content-Length": form.getLengthSync()
  }

  const response = await axios.post(url, form, {headers})
  const status = response.status

  if(status < 400 && status >= 200) {
    const token = response.data.match(/input.*name="created-personal-access-token.*value="((\w|-)+)"/)[1]
    console.log({token})
    return token
  }
} 

module.exports = createProjectToken
