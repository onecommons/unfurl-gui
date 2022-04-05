/*
process.env.OC_URL = 'http://skelaware.abreidenbach.com:3000'
process.env.OC_USERNAME = 'root'
process.env.OC_PASSWORD = '******'
*/

const FormData = require('form-data')
const form = new FormData()
const axios = require('./axios-instance.js')
const {extractCsrf} = require("./util.js")

const authenticityTokenRegex = /name="csrf-token"\s+content="(([A-Za-z0-9+/=])+)"/i
let loggedIn = false
async function login(gitlabURL, gitlabUsername, gitlabPassword) {
  if(loggedIn) return
  loggedIn = true

  const signInURL = `${gitlabURL || process.env.OC_URL}/users/sign_in`
  const res = await axios.get(signInURL)
  const authenticity_token = extractCsrf(res.data)
  form.append('authenticity_token', authenticity_token)
  form.append('user[login]', gitlabUsername || process.env.OC_USERNAME)
  form.append('user[password]', gitlabPassword || process.env.OC_PASSWORD)
  form.append('user[remember_me]', 0)

  const headers = {
    ...form.getHeaders(),
    "Content-Length": form.getLengthSync()
  }

  const status = (await axios.post(signInURL, form, {headers})).status

  return status < 400 && status >= 200
}

module.exports = login
