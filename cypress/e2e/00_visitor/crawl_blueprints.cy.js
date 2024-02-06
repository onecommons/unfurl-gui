import axios from 'axios'

const OC_URL = Cypress.env('OC_URL')
const NAMESPACE_PROJECTS = Cypress.env('NAMESPACE_PROJECTS')

describe('Blueprints namespace', () => {
  let projects = NAMESPACE_PROJECTS.split(',').filter(p => !!p)
  it('Should have more than one project', () => {
    expect(projects).not.to.have.length(0)
  })

  for(let projectName of projects) {
    describe(projectName, () => {
      function withCurrentProject(cb) {
        if(withCurrentProject.stored) {
          cb(withCurrentProject.stored)
        } else {
          cy.fixture('/tmp/namespace_projects').then(projects => {
            const project = withCurrentProject.stored = projects.find(p => p.name == projectName)
            cb(project)
          })
        }
      }

      before(() => {
        withCurrentProject(project => cy.visit(project.relative_path))
      })

      afterEach(() => {
        cy.get('.flash-container .gl-alert-danger').should('not.exist')
      })

      function thisProject(assertion, cb) {
        it(assertion, () => {
          withCurrentProject(cb)
        })
      }

      thisProject('has a functional share button', project => {
        const imgSrc = `${OC_URL}${project.relative_path}/-/deploybutton.svg`
        cy.contains('.star-btn', 'Share').click()
        cy.contains("Create an embeddable 'Deploy With Unfurl' button for this blueprint.").should('be.visible')

        cy.get(`img[src="${imgSrc}"]`).should('be.visible')

        // this is probably a bug
        // cy.contains('label', 'Show cloud logos').click()
        cy.contains('label', 'Show cloud logos').prev().click()
        cy.get(`img[src^="${imgSrc}"]`).should('have.attr', 'src').should('include', '&cloud=true')

        cy.contains('footer button', 'OK').click()
        cy.contains("Create an embeddable 'Deploy With Unfurl' button for this blueprint.").should('not.exist')
      })

      thisProject('has a deploy counter', project => {
        cy.get('.uf-deploy-count').invoke('text').should('match', /\d+\s+Deploys/)
      })


      if(!['kubernetes-chores', 'Kubernetes Chores'].includes(projectName)) {
        thisProject('has components', project => {
          cy.get('.oc-project-description-box').within(() => {
            cy.contains('a', 'Components').should('be.visible')
          })
        })
      }

      thisProject('has blueprints', project => {
        cy.get('.tabs.gl-tabs').within(() => {
          cy.contains('h5', 'Available Deployment Blueprints').should('be.visible')
        })
      })

      thisProject('has blueprints', project => {
        cy.get('.tabs.gl-tabs').within(() => {
          cy.contains('h5', 'Available Deployment Blueprints').should('be.visible')
        })
      })

      thisProject('has README', project => {
        cy.contains('.gl-card h5', 'README.md').should('be.visible')
      })

      thisProject("can't be developed by this user", project => {
        cy.contains('.nav-link.gl-tab-nav-item').should('not.exist')
      })

      thisProject('can click star', project => {
        cy.contains('button.toggle-star', 'Star').click()
        cy.wait(3000) // give flash a chance to trigger
        cy.get('.flash-container .gl-alert-danger').should('not.exist')
        cy.url().should('contain', '/users/sign_in')
      })
    })
  }
})
