const {extractCsrf} = require("./shared/util.js")
const axios = require('./shared/axios-instance.js')
const FormData = require('form-data')
const login = require('./shared/login.js')

async function createProjectToken(o) {
  const {project, accessLevel} = o
  await login()

  const url = `${process.env.UNFURL_CLOUD_SERVER || process.env.OC_URL}/${project}/-/settings/access_tokens`
  const page = (await axios.get(url)).data
  const authenticity_token = extractCsrf(page)

  const form = new FormData()

  // const FIELD_NAME = process.env.GITLAB_VERSION == '14.9'?
    // 'resource_access_token': 'project_access_token'
  const FIELD_NAME = 'resource_access_token'

  form.append('authenticity_token', authenticity_token)
  form.append(`${FIELD_NAME}[name]`, 'UNFURL_PROJECT_TOKEN')
  form.append(`${FIELD_NAME}[access_level]`, accessLevel || 40)
  form.append(`${FIELD_NAME}[expires_at]`, '')
  form.append(`${FIELD_NAME}[scopes][]`, 'api')
  form.append(`${FIELD_NAME}[scopes][]`, 'read_api')
  form.append(`${FIELD_NAME}[scopes][]`, 'read_repository')
  form.append(`${FIELD_NAME}[scopes][]`, 'write_repository')
  form.append(`${FIELD_NAME}[scopes][]`, 'read_registry')
  form.append(`${FIELD_NAME}[scopes][]`, 'write_registry')

  const headers = {
    ...form.getHeaders(),
    "Content-Length": form.getLengthSync()
  }

  const response = await axios.post(url, form, {headers})

  /*
   * can't use API with admin user session?
   * I'll try again later with a CSRF token
  const url = `${process.env.UNFURL_CLOUD_SERVER || process.env.OC_URL}/api/v4/projects/${encodeURIComponent(project)}/access_tokens`
  const response = await axios.post(
    url,
    {
      name: 'UNFURL_PROJECT_TOKEN',
      scopes: ['api', 'read_api', 'read_repository', 'write_repository', 'read_registry', 'write_registry'],
      access_level: 40,
    }
  )
  */

  const status = response.status

  if(status < 400 && status >= 200) {
    if(response.data.new_token) {
      return response.data.new_token
    }
    const token = response.data.match(/input.*name="created-personal-access-token.*value="((\w|-)+)"/)[1]
    return token
  } else {
    console.error(response)
    throw new Error(`Couldn't create project access token on ${project}`)
  }
} 

module.exports = createProjectToken
