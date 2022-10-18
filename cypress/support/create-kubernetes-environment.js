const BASE_URL = Cypress.env('OC_URL')
const ENVIRONMENT_NAME = Cypress.env('K8S_ENVIRONMENT_NAME')
const K8S_CLUSTER_NAME = Cypress.env('K8S_CLUSTER_NAME')
const K8S_CONTEXT = Cypress.env('K8S_CONTEXT')
const K8S_CA_CERT = Cypress.env('K8S_CA_CERT')
const K8S_INSECURE = Cypress.env('K8S_INSECURE')
const K8S_AUTH_TOKEN = Cypress.env('K8S_AUTH_TOKEN')
const K8S_NAMESPACE = Cypress.env('K8S_NAMESPACE')
const K8S_BASE_URL = Cypress.env('K8S_BASE_URL')
const AWS_ACCESS_KEY = Cypress.env('AWS_ACCESS_KEY_ID')
const AWS_SECRET_ACCESS_KEY = Cypress.env('AWS_SECRET_ACCESS_KEY')
const REPOS_NAMESPACE = Cypress.env('REPOS_NAMESPACE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')
const AWS_DNS_ZONE = Cypress.env('AWS_DNS_ZONE')
const AWS_DNS_TYPE = Cypress.env('AWS_DNS_TYPE')
const AWS_DEFAULT_REGION = Cypress.env('AWS_DEFAULT_REGION')
const USERNAME = Cypress.env('OC_IMPERSONATE')

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

Cypress.Commands.add('createK8SEnvironment', (options) => {
  const { environmentName, shouldCreateExternalResource, shouldCreateDNS } = Object.assign(
    {
      environmentName: ENVIRONMENT_NAME,
    },
    options
  )

  cy.visit(`${BASE_URL}/${USERNAME}/dashboard/-/environments`)
  createEnvironmentButton().click()
  cy.k8sCompleteEnvironmentDialog({environmentName})
  cy.url().should('include', environmentName)
  cy.contains(environmentName).should('exist')
  cy.contains('Kubernetes').should('exist')

  cy.wait(BASE_TIMEOUT / 2)


  if(K8S_CLUSTER_NAME) {
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-name"]').type(K8S_CLUSTER_NAME)
  }
  if(K8S_CONTEXT) {
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-context"]').type(K8S_CONTEXT)
  }
  if(K8S_CA_CERT) {
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-cluster_ca_certificate"]').type(K8S_CA_CERT)
  }
  if(K8S_INSECURE) {
    cy.get('label[data-testid="oc-input-primary_provider-insecure"] input[type="checkbox"]').click({force: true})
  }
  if(K8S_AUTH_TOKEN) {
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-token"]').type(K8S_AUTH_TOKEN)
  }
  if(K8S_NAMESPACE) {
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-namespace"]').type(K8S_NAMESPACE)
  }
  if(K8S_BASE_URL) {
    cy.getInputOrTextarea('[data-testid="oc-input-primary_provider-api_server"]').type(K8S_BASE_URL)
  }

  cy.contains('a', 'Resources').click()

  // create external resource
  if (shouldCreateExternalResource) {
    if(shouldCreateDNS) {
      cy.uncheckedCreateDNS(AWS_DNS_TYPE, AWS_DNS_ZONE)
    }
    cy.uncheckedCreateMail();
    cy.saveExternalResources()
  }
});
