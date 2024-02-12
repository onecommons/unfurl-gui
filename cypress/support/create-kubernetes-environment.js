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
const NAMESPACE = Cypress.env('DEFAULT_NAMESPACE')

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
    cy.get(`label[data-testid="oc-input-${providerName}-insecure"] input[type="checkbox"]`).click({force: true})
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
    annotations = K8S_ANNOTATIONS.split(/,\s*/g).map(ann => ann.split('='))
  } catch(e) {
    console.error(e)
  }

  for(const [key, value] of annotations) {
    cy.contains('button.formily-element-array-base-addition', 'Add').click()
    cy.get('[placeholder="key"]').last().type(key)
    cy.get('[placeholder="value"]').last().type(value)
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

  cy.visit(`/${NAMESPACE}/dashboard/-/environments`)
  createEnvironmentButton().click()
  cy.k8sCompleteEnvironmentDialog({environmentName})
  cy.url().should('include', environmentName)
  cy.contains(environmentName).should('exist')
  cy.contains('Kubernetes').should('exist')

  cy.wait(BASE_TIMEOUT / 2)

  cy.visit(`/${NAMESPACE}/dashboard/-/environments/${environmentName}?provider`)

  enterK8sInfo()

  cy.get('#providerModal').within(() => {
    // forcing because there might have been no changes
    cy.contains('button', 'Save Changes').click({force: true})
  })

  if(KUBECONFIG) {
    cy.wait(BASE_TIMEOUT / 2)
    // easiest way to get rid of modal
    cy.visit(`/${NAMESPACE}/dashboard/-/environments/${environmentName}`)

    cy.contains('a', 'Variables').click()
    cy.get('[data-qa-selector="add_ci_variable_button"]').click()
    cy.get('[data-qa-selector="ci_variable_key_field"] input').type('KUBECONFIG')
    // typing out KUBECONFIG is hilariously slow
    cy.get('[data-qa-selector="ci_variable_value_field"]').invoke('val', KUBECONFIG)
    cy.get('[data-qa-selector="ci_variable_value_field"]').type('\n')
    cy.get('#ci-variable-type').select('File')
    cy.get('[data-qa-selector="ci_variable_save_button"]').click()
  }
  cy.contains('a', 'Resources').click()

  addK8sAnnotations()

  // create external resource
  if (shouldCreateExternalResource) {
    if(shouldCreateDNS) {
      cy.uncheckedCreateDNS(AWS_DNS_TYPE, AWS_DNS_ZONE)
    }
    cy.uncheckedCreateMail();
    cy.saveExternalResources()
  }
});
