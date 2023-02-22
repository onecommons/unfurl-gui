#!/usr/bin/env node
const axios = require('./shared/axios-instance.js')

async function createGroupPath(path) {
  const baseUrl = process.env['OC_URL']

  const splits = path.split('/')
  let id
  try {
    const response = await axios.post(`${baseUrl}/api/v4/groups`, {name: splits[0], path: splits[0]})
    console.log(response.data)
    id = response.data.id
  } catch(e) { console.error(e.message) }

  for(let i = 1; i < splits.length; i++) {
    try {
      const response = await axios.post(
        `${baseUrl}/api/v4/groups`,
        {path: splits[i], name: splits[i], parent_id: id}
      )
      console.log(response.data)
      id = response.data.id
    } catch(e) { console.log(e.message) }
  }
}

async function main() {
  const args = require('minimist')(process.argv.slice(2))
  await createGroupPath(args._[0])
}

async function tryMain() {
  try {
    await main()
  } catch(e) {
    console.error(e.message)
  }
}

tryMain()

module.exports = {createGroupPath}
