const BASE_URL = Cypress.env('CYPRESS_BASE_URL')
const DEMO_URL = BASE_URL + '/demo/apostrophe-demo/-/overview'
const MY_AWESOME_TEMPLATE = DEMO_URL + '/templates/my-awesome-template'

const ocTableRow = (name) => cy.get('.oc_table_row').contains('.oc_table_row', name)
const withinOcTableRow = (name, withinFn) => ocTableRow(name).within(withinFn)


const clickSaveTemplate = () => {
  cy.get('[data-testid="save-template-btn"]').click()
}

const clickTableRowButton = (dependency, buttonName) => {

  cy.get('.oc_table_row')
    .contains('.oc_table_row', dependency)
    .within(()  => cy.get('button').contains('button', buttonName).click())

  cy.wait(100)

}

const launchResourceTemplateDialog = () => {
  /*
  cy.get('.oc_table_row')
    .contains('.oc_table_row', 'host')
    .within(()  => cy.get('button').contains('button', 'Create').click())

  cy.wait(100)
  */

  clickTableRowButton('host', 'Create')
}

const launchRemoveDialog = () => { clickTableRowButton('host', 'Remove') }

import gql from 'graphql-tag'

describe('project overview', () => {

  before(() => {
    cy.visit(DEMO_URL)
      .should('have.property', 'app')
      .then(app => {
        app.$apolloProvider.clients.defaultClient.mutate({
          mutation: gql`
            mutation {
              updateDeploymentObj(input: {projectPath: "demo/apostrophe-demo", typename: "*", patch: "null"}) {errors}
            }
          `,
          variables: {}
        })

      })
      /*.$apolloProvider.clients.defaultClient.mutate({
      mutation: gql`
        updateDeploymentObj(projectPath: "demo/apostrophe-demo", typename: "*", patch: "null") {errors}
      `,
      variables: {}
    })
    */
  })

  describe('overview page', () => {
    beforeEach(() => {
      cy.visit(BASE_URL + '/demo/apostrophe-demo/~/overview')
    })

    it('correctly loads project description box', () => {
      cy.get('.oc-project-description-box')
        .should('be.visible')
    })

    it('should have a store', () => {
      cy.window().its('app.$store').should('exist')
    })

    it('should be able to navigate to a deployment template', () => {
      cy.url().then(url => {
        cy
          .get('.ci-table')
          .get('button[title="Edit"]')
          .first()
          .click()

        cy.wait(1000)
        cy.url().should('not.eq', url)
      })
    })

    it('should be able to create a new template', () => {
      cy.get('button[title="Create new template"]')
        .click()

      cy.wait(100)
      const ocTemplatesDeploy = cy.get('#oc-templates-deploy')
      ocTemplatesDeploy.get(`input[name="input['template-name']"]`)
        .type('My awesome template')

      ocTemplatesDeploy.get(`input[name="input['resource-template-name']"]`)
        .type('My beautiful resource')

      ocTemplatesDeploy.get('.dropdown')
        .click()

      cy.wait(100)
      ocTemplatesDeploy.get('.gl-new-dropdown-item-text-wrapper')
        .first()
        .click()

      ocTemplatesDeploy.get('button.js-modal-action-primary')
        .click()

      cy.wait(100)
      cy.url().should('eq', MY_AWESOME_TEMPLATE)
    })

  }) 

  describe('templates page', () => {
    beforeEach(() => {
      cy.visit(MY_AWESOME_TEMPLATE)
    })


    it('should have my names', () => {
      cy.get('h1').contains('My awesome template').should('be.visible') 
      cy.get('h4').contains('My beautiful resource').should('be.visible') 
    })

    it('has a primary card that turns green when inputs are filled', () => {
      //cy.get('.gl-card-body > .gl-tabs').contains('.gl-tabs, Inputs').first().within(() => {
      const tab = () => cy.get('.gl-tabs a[role="tab"]').first()

      tab().within(() => {cy.get('svg').should('not.have.attr', 'data-testid', 'check-circle-filled-icon')})
      cy.get('.gl-tab-content input[placeholder="image"]').type('my-docker-image')
      cy.get('.gl-tab-content input[placeholder="domain"]').type('unfurl.cloud')
      tab().within(() => {cy.get('svg').should('have.attr', 'data-testid', 'check-circle-filled-icon')})
      //})

    })

    it('can create a resource template', () => {

      launchResourceTemplateDialog()



      // TODO change all awsinstance to some-stupid-name
      cy.get('.modal-content').within(() => {
        
        const input = () => cy.get('input#input1')
        const nextButton = () => cy.get('button').contains('button', 'Next')
        cy.scrollTo(0,0)
        input().type('Some stupid name')

        // fails nextButton().should('be.disabled')

        ocTableRow('AWSInstance').within(_ => cy.get('input[type="radio"]').click({force: true}))

        // fails input().should('have.value', 'Some stupid name'); input().type('AWSInstance')

        nextButton().click()

        cy.wait(500)
      })

      // TODO 
      withinOcTableRow('AWSInstance', () => cy.get('[data-testid="check-circle-filled-icon"]').should('be.visible'))

      cy.get('#awsinstance').should('be.visible')

      clickSaveTemplate()

      cy.wait(500).reload()

      cy.get('#awsinstance').should('be.visible')
    })

    it('scrolls down when we click edit', () => {
      cy.scrollTo(0,0)
      ocTableRow('AWSInstance').within(_ => cy.get('button').contains('button', 'Edit').click())
      cy.wait(500)

      cy.get('#awsinstance').should('be.visible')
    })


    it('has card requirements that turn green when inputs are filled', () => {
      cy.get('#awsinstance').within(() => {
        const tab = () => cy.get('.gl-tabs a[role="tab"]').first()

        tab().within(() => {cy.get('svg').should('not.have.attr', 'data-testid', 'check-circle-filled-icon')})
        cy.get('.gl-tab-content input[placeholder="CPUs"]').type('16')
        cy.get('.gl-tab-content input[placeholder="Memory"]').type('32GB')
        cy.get('.gl-tab-content input[placeholder="storage"]').type('512GB')
        tab().within(() => {cy.get('svg').should('have.attr', 'data-testid', 'check-circle-filled-icon')})
      })
    })

    it('can delete a resource', () => {
      cy.get('#awsinstance').within(() => {
        cy.get('.gl-card-header .dropdown button')
          .first()
          .click()

        cy.wait(100)
        cy.get('.gl-new-dropdown-contents button').contains('button', 'Delete').click()

      })
      cy.wait(500)
      cy.get('.modal-dialog button').contains('button', 'Delete').click()

      cy.get('#awsinstance').should('not.exist')

      clickSaveTemplate()

      cy.wait(500).reload() // we have to wait for the Delete request to finish

      withinOcTableRow('host', () => cy.get('[data-testid="check-circle-filled-icon"]').should('not.exist'))
    })

    it('can remove a resource', () => {
      launchResourceTemplateDialog()

      cy.get('.modal-content').within(() => {
        const input = () => cy.get('input#input1')
        const nextButton = () => cy.get('button').contains('button', 'Next')

        withinOcTableRow('AWSInstance', _ => {
          cy.get('input[type="radio"]').click({force: true})
        })
        nextButton().click()
      })
      

      launchRemoveDialog() 

      cy.get('#oc-delete-node').within(() => cy.get('button').contains('button', 'Remove').click())

      clickSaveTemplate()

      cy.wait(500).reload()
      withinOcTableRow('host', () => cy.get('[data-testid="check-circle-filled-icon"]').should('not.exist'))
    })

    it('can delete a template', () => {
      cy.get('button[title="Delete Template"]').click()
      cy.wait(250)

      cy.get('#oc-delete-template').within(() => {
        cy.get('button').contains('button','Delete').click()
        cy.wait(250)
        cy.url().should('equal', DEMO_URL + '/')
      })
      cy.get('.ci-table').contains('My awesome template').should('not.exist')
    })
  })

 
})
