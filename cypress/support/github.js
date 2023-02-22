const GITHUB_ACCESS_TOKEN = Cypress.env('GITHUB_ACCESS_TOKEN')

function enterGithubToken() {
  cy.visit(`/import/github/new`)
  cy.document().then($document => {
    if(!$document.querySelector('main').textContent.trim().startsWith('Import repos')) {
      cy.get('[data-qa-selector="personal_access_token_field"]').type(GITHUB_ACCESS_TOKEN)
      cy.get('[data-qa-selector="authenticate_button"]').click()
    }

    cy.visit(`/`)
  }) 
}


Cypress.Commands.add('enterGithubToken', enterGithubToken)
