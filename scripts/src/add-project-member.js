const {extractCsrf} = require("./shared/util.js")
const axios = require('./shared/axios-instance.js')
const FormData = require('form-data')
const login = require('./shared/login.js')

async function addProjectMember(o) {
  const {username, project, accessLevel} = o
  await login()

  const matchingUsers = (await axios.get(`${process.env.OC_URL}/-/autocomplete/users.json?search=${username}`)).data

  const user_id = matchingUsers.find(u => u.username == username).id

  const url = `${process.env.OC_URL}/${project}/-/project_members`
  const page = (await axios.get(url)).data
  const authenticity_token = extractCsrf(page)

  const form = new FormData()

  form.append('authenticity_token', authenticity_token)
  form.append('user_ids', user_id)
  form.append('access_level', accessLevel || 10)

  const headers = {
    ...form.getHeaders(),
    "Content-Length": form.getLengthSync()
  }

  const status = (await axios.post(url, form, {headers})).status

  return status < 400 && status >= 200

  /*
  const result = await axios.post(
    `${process.env.OC_URL}/api/v4/projects/${encodeURIComponent(project)}/members`,
    {
      user_id,
      access_level: accessLevel || 10
    }
  )
  */
} 

module.exports = addProjectMember
