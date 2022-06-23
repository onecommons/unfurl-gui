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
//


const 
  DIGITALOCEAN_DNS_TYPE = 'DigitalOceanDNSZone',
  GCP_DNS_TYPE = 'GoogleCloudDNSZone',
  AWS_DNS_TYPE = 'Route53DNSZone'

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
  config.env.BASE_TIMEOUT = config.defaultCommandTimeout || 5000

  const 
    DIGITALOCEAN_DNS_ZONE = config.env.DIGITALOCEAN_DNS_ZONE || 'untrusted.me',
    GCP_DNS_ZONE = config.env.GCP_DNS_ZONE,
    AWS_DNS_ZONE = config.env.AWS_DNS_ZONE

  config.env.GCP_DNS_TYPE = GCP_DNS_ZONE ?
    GCP_DNS_TYPE: DIGITALOCEAN_DNS_TYPE

  config.env.AWS_DNS_TYPE = AWS_DNS_ZONE ?
    AWS_DNS_TYPE: DIGITALOCEAN_DNS_TYPE

  config.env.GCP_DNS_ZONE = GCP_DNS_ZONE || DIGITALOCEAN_DNS_ZONE
  config.env.AWS_DNS_ZONE = AWS_DNS_ZONE || DIGITALOCEAN_DNS_ZONE


  let 
    TEARDOWN = config.env.TEARDOWN ?? '',
    GENERATE_SUBDOMAINS = config.env.GENERATE_SUBDOMAINS ?? ''

  if (typeof TEARDOWN == 'string') TEARDOWN = TEARDOWN.toLowerCase()
  if (typeof GENERATE_SUBDOMAINS == 'string') GENERATE_SUBDOMAINS = GENERATE_SUBDOMAINS.toLowerCase()

  console.log({TEARDOWN, GENERATE_SUBDOMAINS})
  // default true
  config.env.TEARDOWN = !['0', 'false', 'no', false].includes(TEARDOWN)
  // default false
  config.env.GENERATE_SUBDOMAINS = ['1', 'true', 'yes', true].includes(GENERATE_SUBDOMAINS)
    

  console.log(config.env)
  on('task', {
    log (message) {
      console.log(message)
      return null
    }
  })

  return config

}
