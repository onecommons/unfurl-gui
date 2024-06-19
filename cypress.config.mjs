import { defineConfig } from 'cypress'
import setupNodeEvents from './cypress/plugins/index.js'
const BASE_URL = process.env.OC_URL || 'http://localhost:8080'
const defaultCommandTimeout = parseInt(process.env.CY_COMMAND_TIMEOUT) || 15000

export default defineConfig({
  defaultCommandTimeout,
  videoCompression: false,
  video: false,
  numTestsKeptInMemory: 1,
  watchForFileChanges: false,
  // enable for Cypress 12.x
  // experimentalMemoryManagement: true,
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    // setupNodeEvents(on, config) {
    //   return require('./cypress/plugins/index.js')(on, config)
    // },
    setupNodeEvents,
    baseUrl: BASE_URL,
    // enable for Cypress 12.x
    // testIsolation: false,
  },
})
