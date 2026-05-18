// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import 'cypress-fail-fast'
import './commands'

const USERNAME = Cypress.env('OC_USERNAME')
const PASSWORD = Cypress.env('OC_PASSWORD')
const GENERATED_PASSWORD = Cypress.env('GENERATED_PASSWORD')
const IMPERSONATE = Cypress.env('OC_IMPERSONATE')
const MOCK_DEPLOY = Cypress.env('UNFURL_MOCK_DEPLOY') || Cypress.env('MOCK_DEPLOY')
const DEPLOY_IMAGE = Cypress.env('DEPLOY_IMAGE')
const DEPLOY_TAG = Cypress.env('DEPLOY_TAG') // no longer in use
const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')
const DEFAULT_NAMESPACE = Cypress.env('DEFAULT_NAMESPACE')
const INTEGRATION_TEST_ARGS = Cypress.env('INTEGRATION_TEST_ARGS')

const UNFURL_SERVER_URL = Cypress.env('UNFURL_SERVER_URL')
const UNFURL_CLOUDMAP_PATH = Cypress.env('UNFURL_CLOUDMAP_PATH')
const UNFURL_PACKAGE_RULES = Cypress.env('UNFURL_PACKAGE_RULES')
const STANDALONE_UNFURL = Cypress.env('STANDALONE_UNFURL')

const UNFURL_VALIDATION_MODE = Cypress.env('UNFURL_VALIDATION_MODE') || Cypress.env('VALIDATION_MODE')

const EXTERNAL = Cypress.env('EXTERNAL')

Cypress.Cookies.defaults({
  preserve: /.*/
})

function setIntercept() {
  if(UNFURL_SERVER_URL) {
    cy.task('log', `Setting intercept for ${UNFURL_SERVER_URL}`)
    cy.intercept('/services/unfurl-server/*', (req) => {
      req.url = req.url.replace(/.*services\/unfurl-server/, UNFURL_SERVER_URL)
    })
    // figure out how to get around cypress messing with iframe events
    // win.sessionStorage['unfurl_gui:unfurl-server-url'] = UNFURL_SERVER_URL
  }
}

const origLog = Cypress.log

// don't waste memory logging XHR requests
Cypress.log = function (opts, ...other) {
  if ( ['fetch', 'xhr', 'wrap'].includes( opts.displayName )) {
    return
  }
  try {
    if ( opts.message?.includes("TypeError: ") ) {
      console.warn(opts.message)
      return
    }
  } catch(e) {console.error(opts)}
  return origLog(opts, ...other)
}

before(() => {
  Cypress.on('window:before:load', win => {
    console.log(win.gc)
    typeof win.gc == 'function' && win.gc()
    // Pipe browser console output into cypress task logs so we can see why
    // the SPA renders its 404 overlay during the local cypress run.
    const serialize = a => {
      if (a == null) return String(a)
      if (a instanceof Error) return `Error: ${a.message} | ${(a.stack || '').replace(/\n/g, ' \\n ')}`
      if (typeof a === 'object') {
        const proto = Object.getOwnPropertyNames(a)
        try { return JSON.stringify(a, proto.length ? proto : undefined) } catch (_) { return String(a) }
      }
      return String(a)
    }
    for (const level of ['log', 'warn', 'error']) {
      const orig = win.console[level].bind(win.console)
      win.console[level] = (...args) => {
        try {
          const msg = args.map(serialize).join(' ').replace(/\n/g, ' \\n ')
          cy.task('log', `[browser ${level}] ${msg}`, {log: false})
        } catch (_) {}
        orig(...args)
      }
    }
    win.addEventListener('error', e => {
      try { cy.task('log', `[browser windowerror] ${e.message} at ${e.filename}:${e.lineno}:${e.colno} stack=${(e.error && e.error.stack || '').replace(/\n/g, ' \\n ')}`, {log: false}) } catch (_) {}
    })
    win.addEventListener('unhandledrejection', e => {
      const r = e.reason
      const msg = r instanceof Error ? `${r.message} | ${(r.stack || '').replace(/\n/g, ' \\n ')}` : serialize(r)
      try { cy.task('log', `[browser unhandledrejection] ${msg}`, {log: false}) } catch (_) {}
    })
    // Catch notFoundError() calls explicitly with a stack trace so we know
    // which component triggered the 404 overlay.
    const origCreateElement = win.document.createElement.bind(win.document)
    win.document.createElement = function (tag) {
      const el = origCreateElement(tag)
      const origSetAttribute = el.setAttribute.bind(el)
      el.setAttribute = function (name, value) {
        if (name === 'id' && value === '404-overlay') {
          const stack = new Error('notFoundError() called here').stack
          try { cy.task('log', `[browser 404-overlay] ${stack}`, {log: false}) } catch (_) {}
        }
        return origSetAttribute(name, value)
      }
      return el
    }
  })

  Cypress.on('uncaught:exception', (err, runnable) => {
    try { cy.task('log', `[browser uncaught] ${err.message}\n${err.stack}`, {log: false}) } catch (_) {}
    return false
  })
  if(Cypress.spec.name.startsWith('00_visitor')) return
  if((USERNAME && PASSWORD) || (GENERATED_PASSWORD && IMPERSONATE)) {
    cy.visit(`/users/sign_in`).wait(100)
  }
  else {
    cy.visit('/')
  }
  cy.url().then(url => {
    if(url.endsWith('sign_in')) {
      if(USERNAME && PASSWORD)  {
        cy.getInputOrTextarea(`[data-qa-selector="login_field"]`).type(USERNAME)
        cy.getInputOrTextarea(`[data-qa-selector="password_field"]`).type(PASSWORD)
        cy.get(`[data-qa-selector="sign_in_button"]`).click()

        if(IMPERSONATE) {
          cy.visit(`/admin/users/${IMPERSONATE}`)
          cy.get('[data-qa-selector="impersonate_user_link"]').click()
          cy.url().should('not.contain', 'admin')

          if(INTEGRATION_TEST_ARGS.dashboardRepo) {
            cy.visit(`/${DASHBOARD_DEST}`)
          }
        }
      } else if (GENERATED_PASSWORD && IMPERSONATE) {
        cy.getInputOrTextarea(`[data-qa-selector="login_field"]`).type(IMPERSONATE)
        cy.getInputOrTextarea(`[data-qa-selector="password_field"]`).type(GENERATED_PASSWORD)
        cy.get(`[data-qa-selector="sign_in_button"]`).click()

        cy.document().then(doc => {
          if(doc.querySelector('form[action="/users/sign_up/welcome"]')) {
            const selection = EXTERNAL == '0'? 'software_developer': 'other'
            cy.contains('label', 'Choose User Interface').next().select(selection)
            cy.get('[data-qa-selector="get_started_button"]').click()
          }
        })

      }

      if(INTEGRATION_TEST_ARGS.dashboardRepo) {
        cy.visit(`/${DASHBOARD_DEST}`)
      }
    }
  })

  setIntercept()

})

beforeEach(() => {
  setIntercept()

  if(UNFURL_PACKAGE_RULES) {
    cy.intercept('POST', /^.*\/-\/deployments\/new$/, (req) => {
      req.body.pipeline.variables_attributes.push({
        key: 'UNFURL_PACKAGE_RULES',
        masked: false,
        secret_value: UNFURL_PACKAGE_RULES,
        variable_type: 'unencrypted_var',
      })
    })
  }

  // set via unfurl environment in standalone tests
  if(!STANDALONE_UNFURL) {
    cy.document().then(doc => {
      const csrf = doc.querySelector('meta[name="csrf-token"]')?.content

      const win = doc.parentView || doc.defaultView

      cy.request({
        method: 'PATCH',
        url: `/${DASHBOARD_DEST || win.gon.home_project}/-/variables`,
        failOnStatusCode: false,
        headers: {
          'X-CSRF-Token': csrf
        },
        body: {
          "variables_attributes": [
            {
              "key": "UNFURL_SKIP_SAVE",
              "secret_value": "never",
              "environment_scope": "*",
              "variable_type": "env_var",
              "masked": false,
              "protected": false
            }
          ]
        }
      })
    })
  }

  cy.window().then(win => {
    if(DEPLOY_IMAGE) {
      win.sessionStorage['deploy-image'] = DEPLOY_IMAGE
    }
    if(DEPLOY_TAG) {
      win.sessionStorage['deploy-tag'] = DEPLOY_TAG
    }
    if(MOCK_DEPLOY) {
      win.sessionStorage['mock-deploy'] = 't'
    }
    if(DEFAULT_NAMESPACE) {
      win.sessionStorage['defaultNamespace'] = DEFAULT_NAMESPACE
    }
    if(UNFURL_VALIDATION_MODE) {
      win.sessionStorage['unfurl-validation-mode'] = UNFURL_VALIDATION_MODE
    }
    if(UNFURL_CLOUDMAP_PATH) {
      win.sessionStorage['unfurl_gui:cloudmapRepo'] = UNFURL_CLOUDMAP_PATH
    }
    win.sessionStorage['unfurl-trace'] = 't'
  })

})

afterEach(() => {
  cy.window().then(win => {
    // withStore is better, this is good enough for here because we don't know which page we're on
    // we don't want all test to fail when a suite doesn't care about frontend store
    if(win.$store) {
      cy.task(
        'writeArtifact',
        {
          artifactName: `${Cypress.currentTest.titlePath.join(' ')}.json`,
          data: JSON.stringify(win.$store.state)
        }
      )
    }
  })
})
