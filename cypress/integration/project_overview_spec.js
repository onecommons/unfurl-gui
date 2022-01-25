const BASE_URL = Cypress.env('OC_URL') || 'http://localhost:8080'
// TODO move this into a plugin
const GRAPHQL_ENDPOINT = (function(baseUrl){
  const url = new URL(baseUrl)
  const cypressEnvDefined = Cypress.env('OC_GRAPHQL_ENDPOINT')
  if(cypressEnvDefined) return cypressEnvDefined
  if(parseInt(url.port) >= 8080) return '/graphql'
  else return '/api/graphql'

})(BASE_URL)
const NAMESPACE = Cypress.env('OC_NAMESPACE') || 'demo'
const DEMO_URL = `${BASE_URL}/${NAMESPACE}/apostrophe-demo/-/overview`
const MY_AWESOME_TEMPLATE = DEMO_URL + '/templates/my-awesome-template'
const DEMO_URL2 = `${BASE_URL}/${NAMESPACE}/apostrophe-demo-v2/-/overview`
const MY_AWESOME_TEMPLATE2 = DEMO_URL2 + '/templates/my-awesome-template'

const ocTableRow = (name) => cy.get('.oc_table_row').contains('.oc_table_row', name)
const withinOcTableRow = (name, withinFn) => ocTableRow(name).within(withinFn)

const withinCreateDeploymentTemplateDialog = (withinfn) => {
  cy.get('button').contains('button', 'Create new template')
    .click()

  return cy.get('#oc-templates-deploy').within(withinfn)
}


const createMyAwesomeTemplate = () => {
  withinCreateDeploymentTemplateDialog(() => {

    cy.get(`input[name="input['template-name']"]`)
      .type('My awesome template')

    cy.get(`input[name="input['resource-template-name']"]`)
      .type('My beautiful resource')

    cy.get('button').contains('button', 'Next')
      .click()

    cy.url().should('include', 'templates/my-awesome-template')
  })

}

function waitForGraphql() {
  cy.intercept({
    method: "POST",
    url: "**/graphql",
  }).as("dataGetFirst");
  cy.wait("@dataGetFirst");
}


const clickSaveTemplate = () => {
  cy.wait(300) // needs to debounce sometimes
  cy.get('[data-testid="save-template-btn"]').click()
  waitForGraphql()
}

const clickTableRowButton = (dependency, buttonName) => {
  cy.get('.oc_table_row')
    .contains('.oc_table_row', dependency)
    .within(()  => cy.get('button').contains('button', buttonName).click())
}

const launchResourceTemplateDialog = () => clickTableRowButton('host', 'Create')

function getCard(name) {return cy.get(`[data-testid="card-${name}"]`).parent().parent()}
function withinCard(name, cb) {return getCard(name).within(cb)}
function withinCardHeader(cb) {return cy.get('.gl-card-header').within(cb)}
function withinOcInput(cb) { return cy.get('[data-testid="oc_inputs"]').within(cb) }
function withinModal(cb) {return cy.get('.modal-content').within(cb)}
function expectInvalidInput(exclusively=false) {
  cy.get('[data-testid="warning-solid-icon"]').should('exist')
  if(exclusively) cy.get('[data-testid="check-circle-filled-icon"]').should('not.exist')
}
function expectValidInput(exclusively=false) {
  cy.get('[data-testid="check-circle-filled-icon"]').should('exist')
  if(exclusively) cy.get('[data-testid="warning-solid-icon"]').should('not.exist')
}
function selectDependency(dependencyName) {
  cy.get('.oc_table_row').contains('.oc_table_row', dependencyName).within(() => {
    cy.get('input[type="radio"]').click({force: true})
  })
  cy.get('button').contains('button', 'Next').click()

}
function deleteCard(name) {
  withinCard(name, () => {
    cy.get('.dropdown button.dropdown-toggle').click().wait(100)
    cy.get('button.dropdown-item').contains('button.dropdown-item', 'Delete').click()
  })
  cy.wait(200)
  withinModal(() => {
    cy.get('button').contains('button', 'Delete').click()
  })
}
const getAWSCard = () => cy.get('[data-testid="card-awsinstance"]').parent()
const awsCardShould = (should) => cy.get('[data-testid="card-awsinstance"]').should(should)

const launchRemoveDialog = () => { clickTableRowButton('host', 'Remove') }

const operationName = "ClearProjectPath"
const query = "mutation ClearProjectPath($projectPath: ID!, $typename: String!, $patch: JSON!) {\n  updateDeploymentObj(\n    input: {projectPath: $projectPath, typename: $typename, patch: $patch}\n  ) {\n    errors\n    __typename\n  }\n}\n"

function resetDataFromFixture(url, projectPath) {
  cy.on('uncaught:exception', (e) => false) // don't care if we error in here

  cy.visit(`${BASE_URL}/${NAMESPACE}`)

  cy.document().then(doc => {
    const csrfToken = doc.querySelector('meta[name="csrf-token"]')?.content

    cy.fixture(projectPath.replace(NAMESPACE, 'demo')).then((payload) => {
      try {
        cy.log(`resetting data for ${projectPath}`)
        for(const key in payload) {
          const variables = {projectPath, typename: key, patch: payload[key]}
          if (key == 'Overview') continue
          cy.request({
            method:'POST', 
            url: GRAPHQL_ENDPOINT, 
            body: {
              variables, operationName, query,
            },
            headers: {
              'X-CSRF-Token': csrfToken,
              'Content-Type': 'application/json'
            }
          })
        }
      } catch(e) {
        cy.log(`failed to reset data for ${projectPath}: ${e.message}`)
        throw e
      }
    })
    return 
  })
}

describe('project overview v2', () => {
  before(() => {
    resetDataFromFixture(DEMO_URL2, `${NAMESPACE}/apostrophe-demo-v2`)
  })
  describe('overview page', () => {
    beforeEach(() => {
      cy.visit(DEMO_URL2)
      waitForGraphql()
    })

    it('can create a deployment template', () => {
      createMyAwesomeTemplate()
    }) 
  })

  describe('template page', () => {
    beforeEach(() => {
      cy.visit(MY_AWESOME_TEMPLATE2)
      waitForGraphql()
    })

    it('should be invalid', () => {
      withinCard('my-beautiful-resource', () => {
        withinCardHeader(() => {
          expectInvalidInput()
        })
      })
    })

    it('should have invalid inputs', () => {
      withinCard('my-beautiful-resource', () => {
        withinOcInput(() => {
          expectInvalidInput()
        })
      })
    })

    it('should be able to create valid inputs', () => {
      withinCard('my-beautiful-resource', () => {
        withinOcInput(() => {
          expectInvalidInput()
          cy.get('input[placeholder="image"]').type('my amazing image')
          expectInvalidInput()
          cy.get('input[placeholder="domain"]').type('unfurl.cloud')
          expectValidInput()
        })
      })
    })

    it('should keep valid inputs when saved', () => {
      withinCard('my-beautiful-resource', () => {
        withinOcInput(() => {
          cy.get('input[placeholder="image"]').type('my amazing image')
          cy.get('input[placeholder="domain"]').type('unfurl.cloud')
        })
      })
      clickSaveTemplate()

      withinCard('my-beautiful-resource', () => {
        withinOcInput(() => {
          expectValidInput()
        })
      })
    })

    it('should be able to fill inputs in a dependency', () => {
      withinCard('my-beautiful-resource', () => {
        clickTableRowButton('host', 'Create')
      })
      withinModal(() => {
        selectDependency('Compute')
      })
      withinCard('compute', () => {
        withinOcInput(() =>  {
          expectInvalidInput()
          cy.get('input[placeholder="CPUs"]').type('8')
          cy.get('input[placeholder="Memory"]').type('64')
          cy.get('input[placeholder="storage"]').type('1')
          expectValidInput()
        })
        expectValidInput()
      })

      clickSaveTemplate()
      cy.reload()
      withinCard('compute', () => {
        expectValidInput(true)
      })
    })

    it('becomes invalid when an input is removed', () => {
      withinCard('compute', () => {
        withinOcInput(() => {
          cy.get('input[placeholder="CPUs"]').clear()
        })
        expectInvalidInput(true)
      })
    })

    it('can handle recursive dependencies', () => {
      withinCard('my-beautiful-resource', () => {
        clickTableRowButton('db', 'Create')
      })
      withinModal(() => {
        selectDependency('SelfHostedMongoDb')
      })

      withinCard('selfhostedmongodb', () => {
        clickTableRowButton('host', 'Create')
      })

      withinModal(() => {
        selectDependency('DockerHost')
      })

      withinCard('dockerhost', () => {
        withinOcInput(() => {
          cy.get('input[placeholder="CPUs"]').type('8')
          cy.get('input[placeholder="Memory"]').type('64')
          cy.get('input[placeholder="storage"]').type('1')
        })
        expectValidInput(true)
      })

      withinCard('selfhostedmongodb', () => {
        expectValidInput(true)
      })

      clickSaveTemplate()

      cy.reload()

      withinCard('dockerhost', () => {
        expectValidInput(true)
      })

      withinCard('selfhostedmongodb', () => {
        expectValidInput(true)
      })


    })

    it('can retain recursive reactivity', () => {
      withinCard('dockerhost', () => {
        withinOcInput(() => {
          cy.get('input[placeholder="CPUs"]').clear()
        })
        expectInvalidInput(true)
      })

      withinCard('selfhostedmongodb', () => {
        expectInvalidInput()
      })

    })

    it('reacts properly to a deleted node', () => {
      deleteCard('dockerhost')
      withinCard('selfhostedmongodb', () => {
        expectInvalidInput(true)
      })

    })

  })

})

describe('project overview', () => {
  before(() => {
    resetDataFromFixture(DEMO_URL, `${NAMESPACE}/apostrophe-demo`)
  })

  describe('overview page', () => {
    beforeEach(() => {
      cy.visit(DEMO_URL)
      waitForGraphql()
    })

    it('correctly loads project description box', () => {
      cy.get('.oc-project-description-box')
        .should('be.visible')
    })

    /*
    it('should have a store', () => {
      cy.window().its('app.$store').should('exist')
    })
    */

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
      createMyAwesomeTemplate()
      cy.url().should('include', MY_AWESOME_TEMPLATE)
    })
  }) 

  describe('templates page', () => {
    beforeEach(() => {
      cy.visit(MY_AWESOME_TEMPLATE)
      waitForGraphql()
    })


    it('should have my names', () => {
      cy.get('h1').contains('My awesome template').should('be.visible') 
      cy.get('h4').contains('My beautiful resource').should('be.visible') 
    })

    /*
    it('has a primary card that turns green when inputs are filled', () => {
      //cy.get('.gl-card-body > .gl-tabs').contains('.gl-tabs, Inputs').first().within(() => {
      const tab = () => cy.get('.gl-tabs a[role="tab"]').first()

      tab().within(() => {cy.get('svg').should('not.have.attr', 'data-testid', 'check-circle-filled-icon')})
      cy.get('.gl-tab-content input[placeholder="image"]').type('my-docker-image')
      cy.get('.gl-tab-content input[placeholder="domain"]').type('unfurl.cloud')
      tab().within(() => {cy.get('svg').should('have.attr', 'data-testid', 'check-circle-filled-icon')})
      //})

    })
    */

    it("shouldn't have an option to connect", () => {
      ocTableRow('host').within(_ => cy.get('button').contains('Create').should('be.visible'))
      ocTableRow('host').within(_ => cy.get('button').contains('Connect').should('not.exist'))
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

      awsCardShould('be.visible')

      clickSaveTemplate()

      cy.reload()

      awsCardShould('be.visible')
    })

    it('scrolls down when we click edit', () => {
      cy.scrollTo(0,0)
      ocTableRow('AWSInstance').within(_ => cy.get('button').contains('button', 'Edit').click())
      cy.wait(500)

      awsCardShould('be.visible')
    })


    /*
    it('has card requirements that turn green when inputs are filled', () => {
      getAWSCard().within(() => {
        const tab = () => cy.get('.gl-tabs a[role="tab"]').first()

        tab().within(() => {cy.get('svg').should('not.have.attr', 'data-testid', 'check-circle-filled-icon')})
        cy.get('.gl-tab-content input[placeholder="CPUs"]').type('16')
        cy.get('.gl-tab-content input[placeholder="Memory"]').type('32GB')
        cy.get('.gl-tab-content input[placeholder="storage"]').type('512GB')
        tab().within(() => {cy.get('svg').should('have.attr', 'data-testid', 'check-circle-filled-icon')})
      })
    })
    */

    it('can delete a resource', () => {
      getAWSCard().within(() => {
        cy.get('.dropdown button')
          .first()
          .click()

        cy.wait(100)
        cy.get('.gl-new-dropdown-contents button').contains('button', 'Delete').click()

      })
      cy.wait(500)
      cy.get('.modal-dialog button').contains('button', 'Delete').click()

      awsCardShould('not.exist')

      clickSaveTemplate()

      cy.reload() // we have to wait for the Delete request to finish

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

      cy.reload()
      withinOcTableRow('host', () => cy.get('[data-testid="check-circle-filled-icon"]').should('not.exist'))
    })

    it('can delete a template', () => {
      cy.get('button[title="Delete Template"]').click()
      cy.wait(250)

      cy.get('#oc-delete-template').within(() => {
        cy.get('button').contains('button','Delete').click()
        cy.wait(250)
        cy.url().should('include', DEMO_URL)
      })
      cy.get('.ci-table').contains('My awesome template').should('not.exist')
    })
  })

 
})
