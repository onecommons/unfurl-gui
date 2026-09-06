const GITHUB_USERNAME = Cypress.env('GITHUB_USERNAME') || 'onecommons-dummy-220819'
const GITHUB_ACCESS_TOKEN = Cypress.env('GITHUB_ACCESS_TOKEN')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')

const repoName = `buildpack-test-app-${Date.now().toString(36)}`

// TODO break this out into a dedicated helper
describe('_k8s-20221031t185051178z__container-webapp5__container-webapp', () => {
  before(() => {
    cy.exec(`curl "Accept: application/vnd.github+json" -H "Authorization: token ${GITHUB_ACCESS_TOKEN}" https://api.github.com/users/${GITHUB_USERNAME}/repos`).then(({stdout}) => {

      const repos = JSON.parse(stdout)
      let deleteRepo
      repos.filter(repo => repo.name.startsWith('buildpack-test-app-')).forEach(repo => {
        deleteRepo = `curl -X DELETE -H "Accept: application/vnd.github+json" -H "Authorization: token ${GITHUB_ACCESS_TOKEN}" https://api.github.com/repos/${GITHUB_USERNAME}/${repo.name}`
        console.log({deleteRepo})
        cy.exec(deleteRepo, {failOnNonZeroExit: false})
      })

      const fork = `curl -X POST -H "Accept: application/vnd.github+json" -H "Authorization: token ${GITHUB_ACCESS_TOKEN}" https://api.github.com/repos/AjBreidenbach/buildpack-test-app/forks` 

      // putting the name in the fork payload wasn't working as expected
      const rename = `curl -X PATCH -H "Accept: application/vnd.github+json" -H "Authorization: token ${GITHUB_ACCESS_TOKEN}" -H "Content-Type: application/json" -d '{"name": "${repoName}"}' https://api.github.com/repos/${GITHUB_USERNAME}/buildpack-test-app`

      console.log({fork, rename, deleteRepo})
      cy.exec(fork)
      cy.exec(rename)
    })
  })

  const FIXTURE = 'generated/deployments/_aws__container-webapp__container-webapp-k.json'

  it('Can recreate deployment', () => {
    cy.enterGithubToken()
    cy.recreateDeployment({
      verificationArgs: {repository: repoName},
      fixture: FIXTURE,
      afterRecreateDeployment() {
        cy.getInputOrTextarea('[data-testid="oc-input-github-project"]').type(`${GITHUB_USERNAME}/${repoName}`)
        cy.contains('button', 'Import').click({force: true})
        cy.contains('a', 'Container').click()
        cy.get('[data-testid="oc-input-the_app-container.environment-add"]').click()
        cy.getInputOrTextarea('[data-testid="oc-input-the_app-container.environment-key"]').last().type('PORT')
        cy.getInputOrTextarea('[data-testid="oc-input-the_app-container.environment-value"]').last().type('5000')
        cy.get('[data-testid="oc-input-the_app-container.ports-add"]').click()
        cy.getInputOrTextarea('[data-testid="oc-input-the_app-container.ports-value"]').last().type('5000:5000')

        cy.contains('Redeploy every time').click()
        cy.contains('button', 'Imported', {timeout: BASE_TIMEOUT * 3})
        cy.wait(500)
      }
    })
  })
})
