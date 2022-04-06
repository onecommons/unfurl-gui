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
  })

  it('Google Cloud Platform Service', () => {
    // create new deployment
    cy.get('div.gl-responsive-table-row:nth-child(1) > div:nth-child(4) > span:nth-child(1) > button:nth-child(1)').click()
    cy.get('input').clear().type('GCP test')
    cy.get('.js-modal-action-primary > span:nth-child(1)').click()

    // domain_name
    cy.get('div.formily-element-form-item:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > input:nth-child(1)').clear().type('test domain name')
    // admin_email
    cy.get('div.formily-element-form-item:nth-child(2) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > input:nth-child(1)').clear().type('test admin email')
    
    // host
    cy.get('#__BVID__123 > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(3) > button:nth-child(2) > span:nth-child(1)').click()

    // instance
    cy.get('.modal-label > div:nth-child(1) > span:nth-child(2)').click()
    cy.get('#input1').clear().type('test GCP compute instance')
    cy.get('.js-modal-action-primary > span:nth-child(1)').click()

    // num_cpus, mem_size, disk_size
    for (let i = 1; i <= 3; i++) {
      cy.get('div.formily-element-form-item-error:nth-child(' + i + ') > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(3) > input:nth-child(1)').type('1')
    }
    cy.contains('Size of boot disk (in GB)').click()

  })

  it('Amazon Web Services EC2', () => {
    // create new deployment
    cy.get('div.gl-responsive-table-row:nth-child(2) > div:nth-child(4) > span:nth-child(1) > button:nth-child(1)').click()
    cy.get('input').clear().type('AWS EC2 test')
    cy.get('.js-modal-action-primary > span:nth-child(1)').click()

    // domain_name
    cy.get('div.formily-element-form-item:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > input:nth-child(1)').clear().type('test domain name')
    // admin_email
    cy.get('div.formily-element-form-item:nth-child(2) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > input:nth-child(1)').clear().type('test admin email')
    
    // host
    cy.get('#__BVID__123 > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(3) > button:nth-child(2) > span:nth-child(1)').click()

    // instance
    cy.get('.modal-label > div:nth-child(1) > span:nth-child(2)').click()
    cy.get('#input1').clear().type('test EC2 instance')
    cy.get('.js-modal-action-primary > span:nth-child(1)').click()

    // cy.get('html body.ui-indigo.tab-width-8.gl-browser-chrome.gl-platform-mac div.layout-page.hide-when-top-nav-responsive-open.page-with-contextual-sidebar div.content-wrapper.content-wrapper-margin div.container-fluid.container-limited.limit-container-width main#content-body.content div.project-show-custom_oc div#OcAppDeployments div div div.row-fluid.gl-mt-6.gl-mb-6 div.gl-card div.gl-card-body div.card-content-outer div.card-content-container div div div.gl-card.gl-mt-6 div.gl-card-body div.card-content-outer div.card-content-container div#__BVID__365.tabs.gl-tabs div#__BVID__365__BV_tab_container_.tab-content.gl-tab-content div#__BVID__368.tab-pane.gl-mt-3.active div.pt-2.mb-2 div div.formily-element-form-item.formily-element-form-item-layout-horizontal.formily-element-form-item-feedback-layout-loose.formily-element-form-item-label-align-right.formily-element-form-item-control-align-left div.formily-element-form-item-control div.formily-element-form-item-control-content div.formily-element-form-item-control-content-component div.el-input input.el-input__inner').type('AWS EC2 key_name')

    // num_cpus, mem_size, disk_size
    for (let i = 2; i <= 4; i++) {
      cy.get('div.formily-element-form-item-error:nth-child(' + i + ') > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(3) > input:nth-child(1)').type('1')
    }
    cy.contains('Size of boot disk (in GB)').click()

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

