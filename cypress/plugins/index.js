/// <reference types="cypress" />
// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

/**
 * @type {Cypress.PluginConfig}
 */
// eslint-disable-next-line no-unused-vars
module.exports = (on, config) => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config
  //
  const OC_URL = config.env.OC_URL = config.env.OC_URL || 'http://localhost:8080'
  config.env.OC_GRAPHQL_ENDPOINT = (function(baseUrl){
    const url = new URL(baseUrl)
    const cypressEnvDefined = config.env.OC_GRAPHQL_ENDPOINT
    if(cypressEnvDefined) return cypressEnvDefined
    if(parseInt(url.port) >= 8080) return '/graphql'
    else return '/api/graphql'
  })(OC_URL)

  config.env.OC_NAMESPACE = config.env.OC_NAMESPACE || 'demo'
  config.env.REPOS_NAMESPACE = config.env.REPOS_NAMESPACE || 'testing'
  config.env.SIMPLE_BLUEPRINT = config.env.SIMPLE_BLUEPRINT || 'simple-blueprint'

  on('task', {
    log (message) {
      console.log(message)
      return null
    }
  })

  return config

}
