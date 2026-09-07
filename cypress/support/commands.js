// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
//

import './undeploy' // should be imported before run-recreate-deployment
import './run-recreate-deployment'
import './create-aws-environment'
import './create-az-environment'
import './create-gcp-environment'
import './create-digitalocean-environment'
import './create-kubernetes-environment'
import './create-generic-environment'
import './environments'
import './github'
import './ci-jobs'
import 'cypress-wait-until'
import 'cypress-file-upload'
import {dashboardPath} from './dashboard-path'
import {DANGER_ALERT} from './alerts'

const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const USERNAME = Cypress.env('OC_USERNAME')
const PASSWORD = Cypress.env('OC_PASSWORD')
const DEPLOY_IMAGE = Cypress.env('DEPLOY_IMAGE')
const MOCK_DEPLOY = Cypress.env('UNFURL_MOCK_DEPLOY') || Cypress.env('MOCK_DEPLOY')
const INTEGRATION_TEST_ARGS = Cypress.env('INTEGRATION_TEST_ARGS')
const UNFURL_SERVER_URL = Cypress.env('UNFURL_SERVER_URL')
const UNFURL_VALIDATION_MODE = Cypress.env('UNFURL_VALIDATION_MODE') || Cypress.env('VALIDATION_MODE')
const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')

function whenUnfurlGUI(cb) {
  cy.window().then(win => {
    if(win.gon.unfurl_gui) {
      cb()
    }
  })
}

function whenGitlab(cb) {
  cy.window().then(win => {
    if(!win.gon.unfurl_gui) {
      cb()
    }
  })
}

function withStore(cb) {
  return cy.waitUntil(() => cy.window().then(win => {
    if(win.$store.getters.environmentsAreReady) {
      cb && cb(win.$store)
      return cy.wrap(win.$store)
    }
    else {return false}
  }), {timeout: BASE_TIMEOUT * 2,  interval: 500})
}

function assertNoErrors() {
  cy.get(DANGER_ALERT).should('not.exist')
  withStore().then(store => store.getters).should('have.property', 'hasCriticalErrors', false)
}

function getInputOrTextarea(selector) {
  return cy.get(`input${selector}, textarea${selector}, ${selector} input`)
}

function execLoud(...args) {
  return cy.exec(...args).then(async result => {
    console.log(result)
    cy.task('log', `[${args[0]}][stdout]\n${result.stdout}`)
    cy.task('error', `[${args[0]}][stderr]\n${result.stderr}`)
    return cy.wrap(result)
  })
}

function login(username, password, impersonate) {
  cy.visit(`/users/sign_in`).wait(100)
  cy.url().then(url => {
    if(username && password && url.endsWith('sign_in'))  {
      cy.getInputOrTextarea(`[data-qa-selector="login_field"]`).type(username)
      cy.getInputOrTextarea(`[data-qa-selector="password_field"]`).type(password)
      cy.getInputOrTextarea(`[data-qa-selector="sign_in_button"]`).click()

      if(impersonate) {
        cy.visit(`/admin/users/${impersonate}`)
        cy.get('[data-qa-selector="impersonate_user_link"]').click()
        cy.url().should('not.contain', 'admin')

        if(INTEGRATION_TEST_ARGS.dashboardRepo) {
          cy.visit(dashboardPath(``))
        }
      }
    }
  })
}

function logout() {
  cy.get('[data-qa-selector="stop_impersonation_link"]').click()
  cy.get('[data-qa-selector="user_menu"]').click()
  cy.get('[data-qa-selector="sign_out_link"]').click()
  cy.url().should('include', 'sign_')
}

/*
 * Cypress 12.x
function login(impersonateUser) {
  cy.session(impersonateUser || USERNAME, () => {
    cy.visit(`/users/sign_in`).wait(100)
    cy.url().then(url => {
      if(USERNAME && PASSWORD && url.endsWith('sign_in'))  {
        cy.getInputOrTextarea(`[data-qa-selector="login_field"]`).type(USERNAME)
        cy.getInputOrTextarea(`[data-qa-selector="password_field"]`).type(PASSWORD)
        cy.getInputOrTextarea(`[data-qa-selector="sign_in_button"]`).click()

        if(impersonateUser) {
          cy.visit(`/admin/users/${impersonateUser}`)
          cy.get('[data-qa-selector="impersonate_user_link"]').click()
          cy.url().should('not.contain', 'admin')

        }
      }
    })
    cy.window().then(win => {
      if(DEPLOY_IMAGE) {
        win.sessionStorage['deploy-image'] = DEPLOY_IMAGE
      }
      if(MOCK_DEPLOY) {
        win.sessionStorage['mock-deploy'] = 't'
      }
      if(UNFURL_VALIDATION_MODE) {
        win.sessionStorage['unfurl-validation-mode'] = UNFURL_VALIDATION_MODE
      }
      if(UNFURL_SERVER_URL) {
        win.sessionStorage['unfurl-server-url'] = UNFURL_SERVER_URL
      }
      win.sessionStorage['unfurl-trace'] = 't'
    })
    cy.visit(dashboardPath(``))
  },
  {
    cacheAcrossSpecs: false,
    validate() {
      cy.visit('/')
      cy.url().should('not.contain', 'login')
    }
  })

}
*/

Cypress.Commands.add('whenGitlab', whenGitlab)
Cypress.Commands.add('whenUnfurlGUI', whenUnfurlGUI)
Cypress.Commands.add('withStore', withStore)
Cypress.Commands.add('assertNoErrors', assertNoErrors)
Cypress.Commands.add('getInputOrTextarea', getInputOrTextarea)
Cypress.Commands.add('execLoud', execLoud)
Cypress.Commands.add('login', login)
Cypress.Commands.add('logout', logout)

/*
 * A fullPage capture scrolls and stitches, so anything pinned to the viewport
 * is redrawn in every slice -- the nav bar ends up repeating down the image.
 *
 * Hide those elements for the shot rather than un-pinning them. A fixed
 * element is already out of the document flow, so hiding it changes nothing
 * else; setting `position: static` instead puts it *into* flow, which grew
 * every page by the nav's height and re-parented absolutely-positioned
 * descendants (the environment page's credential card landed on top of the
 * provider row). Sticky elements are in flow, so they only lose their pinning.
 *
 * The nav comes from public/index.html, not oc-pages, so it is not a surface
 * the migration needs to photograph.
 *
 * Pass {selector} to shoot one element instead of the page.
 */
function screenshotStable(name, {selector, keepFixed, ...options} = {}) {
  cy.document().then(doc => {
    const restore = []
    // keepFixed is for when the fixed element IS the subject -- a modal, an
    // overlay. Hiding those would photograph an empty page.
    const subject = keepFixed && selector ? doc.querySelector(selector) : null
    doc.querySelectorAll('*').forEach(el => {
      if (subject && (el === subject || el.contains(subject) || subject.contains(el))) return
      const pos = doc.defaultView.getComputedStyle(el).position
      if (pos === 'fixed') {
        restore.push([el, 'display', el.style.display])
        el.style.display = 'none'
      } else if (pos === 'sticky') {
        restore.push([el, 'position', el.style.position])
        el.style.position = 'relative'
      }
    })
    doc.__cyPinnedRestore = restore
  })

  if (selector) {
    cy.get(selector).screenshot(name, {overwrite: true, ...options})
  } else {
    cy.screenshot(name, {capture: 'fullPage', overwrite: true, ...options})
  }

  cy.document().then(doc => {
    ;(doc.__cyPinnedRestore || []).forEach(([el, prop, prev]) => { el.style[prop] = prev })
    doc.__cyPinnedRestore = null
  })
}

Cypress.Commands.add('screenshotPage', (name, options) => screenshotStable(name, options))
Cypress.Commands.add('screenshotElement', (selector, name, options) =>
  screenshotStable(name, {selector, ...options}))

/*
 * Element screenshot of something fixed-position -- a gl-modal, an overlay.
 * screenshotStable hides fixed elements so a full-page capture does not repeat
 * the sticky nav down the page; that reasoning does not apply when the fixed
 * element is what you are photographing.
 */
Cypress.Commands.add('screenshotOverlay', (selector, name, options) =>
  screenshotStable(name, {selector, keepFixed: true, ...options}))

/*
 * Visit a standalone page built into dist/ that isn't one of the app's routes.
 *
 * `unfurl serve --gui` sends every request whose Accept includes text/html to
 * its project-document handler, which resolves the path as a project and 404s
 * for anything else -- so dist/gallery.html is built and shipped but
 * unreachable by navigation. Its hashed js/css subresources are fine: those
 * requests don't ask for html, so they take the static-file branch.
 *
 * Stubbing just the document is enough, and keeps this out of the server.
 */
Cypress.Commands.add('visitBuiltPage', filename => {
  cy.readFile(`dist/${filename}`).then(html => {
    cy.intercept('GET', `**/${filename}`, {
      statusCode: 200,
      headers: {'content-type': 'text/html; charset=utf-8'},
      body: html,
    })
  })
  cy.visit(`/${filename}`)
})
