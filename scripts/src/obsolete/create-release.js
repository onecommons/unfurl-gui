#!/usr/bin/env node
const axios = require('axios')
const path = require('path')
const fs = require('fs')
const {execFileSync} = require('child_process')
const FormData = require('form-data')

const headers = { 'PRIVATE-TOKEN': process.env.RELEASE_TOKEN }
Object.assign(axios.defaults.headers.common, headers)

const assetSources = {
  'trigger.sh': path.join(__dirname, 'generate-trigger.js')
}

try {
  fs.mkdirSync('assets')
} catch(e) { }

async function main() {
  const links = []
  for(const assetSourceName in assetSources) {
    const assetSourceScript = assetSources[assetSourceName]

    const form = new FormData()
    const output = execFileSync(assetSourceScript)
    form.append(assetSourceName, output, assetSourceName)

    console.log(form.getBuffer().toString('utf-8'))

    const response = await axios.post(`${process.env.CI_SERVER_URL}/api/v4/projects/${process.env.CI_PROJECT_ID}/uploads`, form, {'Content-Type': 'multipart/form-data'}).catch(e => {
      if(e.response) {
        console.error(e.response.data)
      } else {
        console.error(e.message)
      }
      process.exit(1)
    })


    links.push({
      name: assetSourceName,
      url: process.env.CI_SERVER_URL + response.data.full_path,
      direct_asset_path: assetSourceName,
      link_type: 'other'
    })
  }


  const data = { name: process.env.CI_COMMIT_TITLE, tag_name: process.env.CI_COMMIT_SHA, ref_name: process.env.CI_COMMIT_SHA, description: process.env.CI_COMMIT_DESCRIPTION , assets: {links}}
  console.log({data})

  await axios.post(`${process.env.CI_SERVER_URL}/api/v4/projects/${process.env.CI_PROJECT_ID}/releases`).catch(e => {
    if(e.response) {
      console.error(e.response.data)
    } else {
      console.error(e.message)
    }
    process.exit(1)
  })
}

main()
