#!/usr/bin/env node

const {extractCsrf} = require("./shared/util.js")
const axios = require('./shared/axios-instance.js')
const FormData = require('form-data')
const login = require('./shared/login.js')

function envName(o) {
  return o.name || o['environment-name'] || o['env-name'] || o.env
}

let authenticity_token

async function createEnvironment(o) {
  if(!o) throw new Error('expected options to create new environment')
  await login()
  const environmentURL = `${process.env.UNFURL_CLOUD_SERVER || process.env.OC_URL}/${o['project-path']}/-/environments`
  const res = await axios.get(environmentURL)
  authenticity_token = extractCsrf(res.data)
  const form = new FormData()
  form.append('environment[name]', envName(o))
  if(o.provider) {
    form.append('provider', o.provider)
  }
  form.append('authenticity_token', authenticity_token)

  const headers = {
    ...form.getHeaders(),
    "Content-Length": form.getLengthSync()
  }

  const status = (await axios.post(environmentURL, form, {headers})).status

  return status < 400 && status >= 200
}

module.exports = createEnvironment

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
  console.log('Creating environment...')
  const {lookupCloudProviderAlias} = await import('../../packages/oc-pages/vue_shared/util.mjs')
  if(! await createEnvironment(args)) {
    throw new Error('Failed to create user')
  }
  let primaryProviderType = lookupCloudProviderAlias(args.provider)
  if(primaryProviderType) {
    const payload = {
      operationName: "UpdateDeploymentObject",
        variables: {
          fullPath: args['project-path'],
            patch: [
              {
                name: envName(args),
                __typename: "DeploymentEnvironment",
                connections: {
                  primary_provider: {
                    name: "primary_provider",
                    type: primaryProviderType,
                    __typename: "ResourceTemplate"
                  }
                },
                instances: {}
              }
            ],
            path: "environments.json"
        },
        query: "mutation UpdateDeploymentObject($fullPath: ID!, $patch: JSON!, $path: String!) {\n  updateDeploymentObj(input: {projectPath: $fullPath, patch: $patch, path: $path}) {\n    isOk\n    errors\n    __typename\n  }\n}\n"
    }

    const {data} = await axios.post(`${process.env.UNFURL_CLOUD_SERVER || process.env.OC_URL}/api/graphql`, payload, {headers: {'X-CSRF-Token': authenticity_token}})
    if(data.errors && data.errors.length) throw new Error(data.errors[0].message)
  }
}
