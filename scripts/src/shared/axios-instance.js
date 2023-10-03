const axios = require('axios')
axios.defaults.withCredentials = true
axios.defaults.validateStatus = () => true

if(process.env['OC_TOKEN']) {
  axios.defaults.headers.common['PRIVATE-TOKEN'] = process.env['OC_TOKEN']
  axios.defaults.headers.common['Accept-Language'] = 'en-US'
}

const { wrapper } = require('axios-cookiejar-support')
const { CookieJar } = require('tough-cookie')
const jar = new CookieJar()
module.exports = wrapper(axios.create({ jar }))
