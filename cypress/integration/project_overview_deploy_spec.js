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
  return cy.get('h4').contains('Create New Deployment')
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

const OVERVIEW = `${BASE_URL}/testing/simple-blueprint`
describe('project overview deploy', () => {
  before(() => {
    cy.resetDataFromFixture(`testing/simple-blueprint`, 'blueprints/blueprint.json')
  })
  beforeEach (() => {
    cy.visit(OVERVIEW)
    //cy.window().then(window => window.gon.current_username = 'user1')
  })

  it('Blueprint Page', () => {
    cy.contains('Your application blueprint')
    cy.task('log', 'Your application blueprint column exists')
    cy.contains('Extras')
    cy.task('log', ' Extras column')
    cy.contains('Details')
    cy.task('log', ' Details column')
    cy.screenshot()
  })

  it('Services', () => {
    cy.contains('Google Cloud Platform')
    cy.task('log', ' Google Cloud Platform exists')
    cy.contains('Amazon Web Services EC2')
    cy.task('log', ' Amazon Web Services EC2 exists')
    cy.contains('Kubernetes')
    cy.task('log', ' Kubernetes exists')
    cy.contains('Self-Hosted')
    cy.task('log', ' Self-Hosted exists')
    cy.screenshot()

    // let base = '//*[@id="OcAppDeployments"]/div/div[2]/div[2]/div/div/div/div['
    // let end = ']/div[4]/span/button'
    // for (let i = 1; i <= 4; i++) {
    //   cy.get(base + i + end).click()
    //   cy.contains('Create New Deployment')
    //   cy.contains('Select an environment to deploy this template to:')
    //   cy.contains('Cancel').click()
    // }
  })



  // it('serializes state', () => {

  //   cy.on('uncaught:exception', (e) => false) // problems with duplicate navigation
  //   const myAwesomeDeployment = 'My awesome deployment'
  //   cy.location('search').should('equal', '')
  //   openDeployDialog('Google Cloud Platform')
  //   deploymentNameInput().clear().type(myAwesomeDeployment)
  //   modalHeader().click()
  //   cy.location('search').should('not.equal', '')
  //   cy.reload()
  //   cy.waitForGraphql()
  //   cy.wait(400) // not sure why this takes so long
  //   modalHeader().should('be.visible')

  //   deploymentNameInput().should('have.value', myAwesomeDeployment)
  // })
  

  // it('can click away to clear search params', () => {
  //   const myAwesomeDeployment = 'My awesome deployment'
  //   cy.location('search').should('equal', '')
  //   openDeployDialog('Google Cloud Platform')
  //   deploymentNameInput().clear().type(myAwesomeDeployment)
  //   modalHeader().click()
  //   cy.location('search').should('not.equal', '')

  //   //cy.get('.modal-backdrop').click({force: true})
  //   cy.get('body').click(10,10)

  //   cy.wait(300)

  //   cy.location('search').should('equal', '')

  // })

  // it('can enter deployment creation view', () => {
  //   cy.on('uncaught:exception', (e) => false) // problems with duplicate navigation
  //   openDeployDialog('Self-Hosted')
  //   deploymentNameInput().clear().type('My awesome deployment')

  //   nextButton().should('be.disabled')

  //   selectEnvironmentButton().click()
  //   cy.wait(100)
  //   selectEnvironmentButton('production-gcp').click()
  //   cy.wait(100)
  //   nextButton().should('not.be.disabled')

  //   nextButton().click()
  // })

  /*
  it('can deploy', () => {

    openDeployDialog('Google Cloud Platform')
    deploymentNameInput().clear().type('My awesome deployment')

    nextButton().click()

    cy.url().should('contain', 'deployment-drafts/production-gcp/my-awesome-deployment')

    cy.get('button[title="Deploy"]').click()

    //cy.intercept({method: 'POST', url:'**$$$remove$$$/graphql'}, (req) => {
      //console.log(req.body.variables)
    //}).as('submissions')

    // need the post request to stop crashing us
  })

  */

})

