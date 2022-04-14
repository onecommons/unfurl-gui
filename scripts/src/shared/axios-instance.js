const axios = require('axios')
axios.defaults.withCredentials = true
axios.defaults.validateStatus = () => true
const { wrapper } = require('axios-cookiejar-support')
const { CookieJar } = require('tough-cookie')
const jar = new CookieJar()
module.exports = wrapper(axios.create({ jar }))
