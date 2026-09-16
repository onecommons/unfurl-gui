const GITHUB_ACCESS_TOKEN = Cypress.env('GITHUB_ACCESS_TOKEN')

function enterGithubToken() {
  cy.visit(`/import/github/new`)
  cy.document().then($document => {
    if(!$document.querySelector('main').textContent.trim().startsWith('Import repos')) {
      // GitLab 19 dropped data-qa-selector product-wide and these two became
      // testids, underscores to hyphens (import/github/new.html.haml). Both
      // spellings are accepted while 15.11 and 19.3 are both in play.
      cy.get('[data-testid="personal-access-token-field"], [data-qa-selector="personal_access_token_field"]')
        .type(GITHUB_ACCESS_TOKEN)
      cy.get('[data-testid="authenticate-button"], [data-qa-selector="authenticate_button"]').click()
    }

    cy.visit(`/`)
  }) 
}


Cypress.Commands.add('enterGithubToken', enterGithubToken)
