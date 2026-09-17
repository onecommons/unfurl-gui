import {dashboardPath} from './dashboard-path'
const ENVIRONMENT_NAME = Cypress.env('K8S_ENVIRONMENT_NAME')
const K8S_CLUSTER_NAME = Cypress.env('K8S_CLUSTER_NAME')
const K8S_CONTEXT = Cypress.env('K8S_CONTEXT')
const K8S_CA_CERT = Cypress.env('K8S_CA_CERT')
const K8S_INSECURE = Cypress.env('K8S_INSECURE')
const K8S_AUTH_TOKEN = Cypress.env('K8S_AUTH_TOKEN')
const K8S_NAMESPACE = Cypress.env('K8S_NAMESPACE')
const K8S_BASE_URL = Cypress.env('K8S_BASE_URL')
const K8S_ANNOTATIONS = Cypress.env('K8S_ANNOTATIONS') || ''
const KUBECONFIG = Cypress.env('KUBECONFIG')
const AWS_ACCESS_KEY = Cypress.env('AWS_ACCESS_KEY_ID')
const AWS_SECRET_ACCESS_KEY = Cypress.env('AWS_SECRET_ACCESS_KEY')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const AWS_DNS_ZONE = Cypress.env('AWS_DNS_ZONE')
const AWS_DNS_TYPE = Cypress.env('AWS_DNS_TYPE')
const AWS_DEFAULT_REGION = Cypress.env('AWS_DEFAULT_REGION')
const USERNAME = Cypress.env('OC_IMPERSONATE')
const DASHBOARD_DEST = Cypress.env('DASHBOARD_DEST')

const createEnvironmentButton = () => cy.contains('button', 'Create New Environment', {timeout: BASE_TIMEOUT * 2})
const ENVIRONMENT_NAME_INPUT = '[data-testid="environment-name-input"]'
const CLOUD_PROVIDER_DROPDOWN = '[data-testid="cloud-provider-dropdown"]'
const ENV_OPTION_K8S = `[data-testid="env-option-k8s"]`

// TODO abstract this into a function that just takes a selection and move it into another module
Cypress.Commands.add('k8sCompleteEnvironmentDialog', options => {
  const {
    chooseCloudProvider,
    environmentName
  } = Object.assign({
    chooseCloudProvider: true,
    environmentName: ENVIRONMENT_NAME
  }, options)

  cy.get(ENVIRONMENT_NAME_INPUT).type(environmentName)
  if(chooseCloudProvider) {
    cy.get(CLOUD_PROVIDER_DROPDOWN).click()
    cy.get(ENV_OPTION_K8S).click()
  }
  cy.contains('button', 'Next').click()
})

function enterK8sInfo(providerName='primary_provider') {
  if(K8S_CLUSTER_NAME) {
    cy.getInputOrTextarea(`[data-testid="oc-input-${providerName}-name"]`).type(K8S_CLUSTER_NAME)
  }
  if(K8S_CONTEXT) {
    cy.getInputOrTextarea(`[data-testid="oc-input-${providerName}-context"]`).type(K8S_CONTEXT)
  }
  if(K8S_CA_CERT) {
    cy.getInputOrTextarea(`[data-testid="oc-input-${providerName}-cluster_ca_certificate"]`).type(K8S_CA_CERT)
  }
  if(K8S_INSECURE) {
    cy.getInputOrTextarea(`[data-testid="oc-input-${providerName}-insecure"]`).click({force: true})
  }
  if(K8S_AUTH_TOKEN) {
    cy.getInputOrTextarea(`[data-testid="oc-input-${providerName}-token"]`).type(K8S_AUTH_TOKEN)
  }
  if(K8S_NAMESPACE) {
    cy.getInputOrTextarea(`[data-testid="oc-input-${providerName}-namespace"]`).type(K8S_NAMESPACE)
  }
  if(K8S_BASE_URL) {
    cy.getInputOrTextarea(`[data-testid="oc-input-${providerName}-api_server"]`).type(K8S_BASE_URL)
  }

  // cypress is bending reality without this sleep
  cy.wait(1000)
}

function addK8sAnnotations() {
  let annotations = []

  try {
    // filter: ''.split() yields [''], so an unset K8S_ANNOTATIONS still ran one
    // iteration and looked for an Add button with no annotation to add
    annotations = K8S_ANNOTATIONS.split(/,\s*/g).filter(Boolean).map(ann => ann.split('='))
  } catch(e) {
    console.error(e)
  }

  if(!annotations.length) return

  // The KUBECONFIG block above leaves the Variables tab showing, and the cards
  // are on Resources -- without this the card below is in the DOM but hidden.
  cy.contains('a', 'Resources').click()

  // The inputs sit behind a tab on the card that carries them, and the card's
  // header is a toggle -- so clicking it unconditionally closes a card that was
  // already open, which leaves everything below in the DOM and invisible.
  // Expand only when the tab is not already showing.
  cy.get('[data-testid^="tab-annotations-"]').invoke('attr', 'data-testid').then(tab => {
    const card = `[data-testid="card-${tab.replace('tab-annotations-', '')}"]`

    cy.get(`[data-testid="${tab}"]`).then($tab => {
      if (!$tab.is(':visible')) cy.get(card).click()
    })

    cy.get(`[data-testid="${tab}"]`).click()
  })

  // providerName isn't in scope here, so match on the property suffix
  for(const [key, value] of annotations) {
    cy.get('[data-testid$="annotations.$additionalProperties-add"]').click()
    cy.getInputOrTextarea('[data-testid$="annotations.$additionalProperties-key"]')
      .last().type(key)
    cy.getInputOrTextarea('[data-testid$="annotations.$additionalProperties-value"]')
      .last().type(value)
  }
}

Cypress.Commands.add('enterK8sInfo', enterK8sInfo)
Cypress.Commands.add('addK8sAnnotations', addK8sAnnotations)
Cypress.Commands.add('createK8SEnvironment', (options) => {
  const { environmentName, shouldCreateExternalResource, shouldCreateDNS } = Object.assign(
    {
      environmentName: ENVIRONMENT_NAME,
    },
    options
  )

  let environmentCreated

  cy.whenEnvironmentAbsent(environmentName, () => {
    cy.visit(dashboardPath(`/-/environments`))
    createEnvironmentButton().click()
    cy.k8sCompleteEnvironmentDialog({environmentName})
    cy.url().should('include', environmentName)
    cy.contains(environmentName).should('exist')
    cy.contains('Kubernetes').should('exist')

    cy.wait(BASE_TIMEOUT / 2)

    cy.visit(dashboardPath(`/-/environments/${environmentName}?provider`))

    enterK8sInfo()

    cy.get('#providerModal').within(() => {
      // forcing because there might have been no changes
      cy.contains('button', 'Save Changes').click({force: true})
    })

    if(KUBECONFIG) {
      cy.wait(BASE_TIMEOUT / 2)
      // easiest way to get rid of modal
      cy.visit(dashboardPath(`/-/environments/${environmentName}`))

      // The 15.11 modal this used to drive is gone -- the Variables tab is
      // 19.3's drawer now, so none of its data-qa-selectors resolve and
      // #ci-variable-type is a screen-reader label on a listbox rather than
      // the old <select>.
      cy.contains('a', 'Variables').click()
      cy.get('[data-testid="add-ci-variable"]').click()
      cy.get('[data-testid="ci-variable-drawer"]').should('exist')

      cy.getInputOrTextarea('[data-testid="ci-variable-key"]').type('KUBECONFIG')

      // set rather than typed: a kubeconfig is thousands of characters. Vue
      // reads v-model off the input event, which invoke('val') does not fire.
      cy.getInputOrTextarea('[data-testid="ci-variable-value"]')
        .invoke('val', KUBECONFIG)
        .trigger('input')

      // Visible, not the drawer's Masked default: masking requires 8+
      // characters with no whitespace, and a kubeconfig is multi-line, so
      // Masked leaves Save disabled.
      // check({force}) rather than click(): the testid is on the radio input,
      // which its own <label> covers
      cy.get('[data-testid="ci-variable-visible-radio"]').check({force: true})

      // File, so the job gets a path to a written-out kubeconfig rather than
      // the yaml inline
      // GlCollapsibleListbox, labelled by the #ci-variable-type sr-only span;
      // its options are [data-testid="listbox-item-<value>"]
      cy.get('#ci-variable-type').parent().find('[data-testid="base-dropdown-toggle"]').click()
      cy.get('[data-testid="listbox-item-FILE"]').click()

      cy.get('[data-testid="ci-variable-confirm-button"]').click()
      cy.get('[data-testid="ci-variable-drawer"]', {timeout: BASE_TIMEOUT}).should('not.exist')
    }
    addK8sAnnotations()

    environmentCreated = true
  })

  // create external resource
  if (shouldCreateExternalResource) {
    cy.whenInstancesAbsent(environmentName, () => {
      environmentCreated || cy.visit(dashboardPath(`/-/environments/${environmentName}`))
      cy.contains('a', 'Resources').click()
      if(shouldCreateDNS) {
        cy.uncheckedCreateDNS(AWS_DNS_TYPE, AWS_DNS_ZONE)
      }
      cy.uncheckedCreateMail();
      cy.saveExternalResources()

      cy.checkMail()
    })
  }
});
