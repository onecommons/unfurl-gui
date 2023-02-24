#!/usr/bin/env node
const axios = require('./shared/axios-instance.js')

async function addUserToGroup({user, group, access_level}) {
  const baseUrl = process.env['OC_URL']

  let user_id

  for(let i = 0; i < 20; i++) {
    console.log(`${baseUrl}/api/v4/users?username=${user}`)
    const response = (await axios.get(`${baseUrl}/api/v4/users?username=${user}`))//.data[0].id
    await new Promise(resolve => setTimeout(resolve, 5000))

    try {
      user_id = response.data[0].id
      break
    } catch(e) {
      console.log(e.message)
    }
  }

  try {
    const response = await axios.post(`${baseUrl}/api/v4/groups/${encodeURIComponent(group)}/members`, {user_id, access_level})
    console.log(response.data)
  } catch(e) { console.error(e.message) }
}

async function main() {
  const args = require('minimist')(process.argv.slice(2))
  await addUserToGroup({
    access_level: args['access-level'] || 40,
    ...args
  })
}

async function tryMain() {
  try {
    await main()
  } catch(e) {
    console.error(e.message)
  }
}

tryMain()

module.exports = {addUserToGroup}
