const BASE_URL = Cypress.env('OC_URL')
const GITHUB_ACCESS_TOKEN = Cypress.env('GITHUB_ACCESS_TOKEN')

function enterGithubToken() {
  cy.visit(`${BASE_URL}/import/github/new`)
  cy.document().then($document => {
    if(!$document.querySelector('main').textContent.trim().startsWith('Import repos')) {
      cy.get('[data-qa-selector="personal_access_token_field"]').type(GITHUB_ACCESS_TOKEN)
      cy.get('[data-qa-selector="authenticate_button"]').click()
    }

    cy.visit(`${BASE_URL}`)
  }) 
}


Cypress.Commands.add('enterGithubToken', enterGithubToken)
