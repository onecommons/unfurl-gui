const BASE_URL = Cypress.env('OC_URL')
const GRAPHQL_ENDPOINT = Cypress.env('OC_GRAPHQL_ENDPOINT')
const NAMESPACE = Cypress.env('OC_NAMESPACE')


function openDeployDialog(text) {
  cy.get('.oc_table_row').contains('.oc_table_row', text)
    .within(() => {
      cy.get('button').contains('button', 'Deploy').click()
    })
  cy.wait(300)
}

function modalHeader() {
  return cy.get('h4').contains('Create new deployment')
}

function deploymentNameInput() {
  return cy.get(`input[name="input['template-name']"]`)
}


function nextButton() {
  return cy.get('.modal-dialog button').contains('button', 'Next')
}

function closeButton() {
  return cy.get('.modal-dialog button').contains('button', 'Close')
}

function selectEnvironmentButton(text) {
  return cy.get('.modal-dialog button').contains('button', text || 'Select')
}

const OVERVIEW = `${BASE_URL}/${NAMESPACE.replace('demo', 'blueprints')}/apostrophe-demo/-/overview`
describe('project overview deploy', () => {
  before(() => {
    cy.resetDataFromFixture(`${NAMESPACE}/apostrophe-demo`, 'blueprints/blueprint.json')
  })
  beforeEach (() => {
    cy.visit(OVERVIEW)
    //cy.window().then(window => window.gon.current_username = 'user1')
  })

  it('can open deploy dialog', () => {
    openDeployDialog('Google Cloud Platform')
    modalHeader().should('be.visible')
  })

  it('serializes state', () => {

    cy.on('uncaught:exception', (e) => false) // problems with duplicate navigation
    const myAwesomeDeployment = 'My awesome deployment'
    cy.location('search').should('equal', '')
    openDeployDialog('Google Cloud Platform')
    deploymentNameInput().clear().type(myAwesomeDeployment)
    modalHeader().click()
    cy.location('search').should('not.equal', '')
    cy.reload()
    cy.waitForGraphql()
    cy.wait(400) // not sure why this takes so long
    modalHeader().should('be.visible')

    deploymentNameInput().should('have.value', myAwesomeDeployment)
  })
  

  it('can click away to clear search params', () => {
    const myAwesomeDeployment = 'My awesome deployment'
    cy.location('search').should('equal', '')
    openDeployDialog('Google Cloud Platform')
    deploymentNameInput().clear().type(myAwesomeDeployment)
    modalHeader().click()
    cy.location('search').should('not.equal', '')

    //cy.get('.modal-backdrop').click({force: true})
    cy.get('body').click(10,10)

    cy.wait(300)

    cy.location('search').should('equal', '')

  })

  it('can enter deployment creation view', () => {
    cy.on('uncaught:exception', (e) => false) // problems with duplicate navigation
    openDeployDialog('Self-Hosted')
    deploymentNameInput().clear().type('My awesome deployment')

    nextButton().should('be.disabled')

    selectEnvironmentButton().click()
    cy.wait(100)
    selectEnvironmentButton('production-gcp').click()
    cy.wait(100)
    nextButton().should('not.be.disabled')

    nextButton().click()
  })

  it('can deploy', () => {

    openDeployDialog('Google Cloud Platform')
    deploymentNameInput().clear().type('My awesome deployment')

    nextButton().click()

    cy.url().should('contain', 'deployment-drafts/production-gcp/my-awesome-deployment')

    cy.get('button[title="Deploy"]').click()

    //cy.intercept({method: 'POST', url:'**/graphql'}, (req) => {
      //console.log(req.body.variables)
    //}).as('submissions')

    // need the post request to stop crashing us
  })


})

