import { defineConfig } from 'cypress'
const BASE_URL = process.env.OC_URL || 'localhost:8080'

export default defineConfig({
  defaultCommandTimeout: 15000,
  videoCompression: false,
  video: false,
  numTestsKeptInMemory: 1,
  watchForFileChanges: false,
  // enable for Cypress 12.x
  // experimentalMemoryManagement: true,
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return require('./cypress/plugins/index.js')(on, config)
    },
    baseUrl: BASE_URL,
    // enable for Cypress 12.x
    // testIsolation: false,
  },
})
