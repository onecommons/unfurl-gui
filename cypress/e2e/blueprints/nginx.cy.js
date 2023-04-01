describe('nginx', () => {
  it('Can recreate deployment', () => {
    cy.recreateDeployment({
      fixture: 'generated/deployments/_aws-20230401t002429182z__container-webapp__container-webapp-dockerhub',
      verificationRoutine: 'default',
      afterRecreateDeployment() {
        cy.contains('a', 'Container').click()
        cy.contains('.formily-element-form-item-label', 'ports').next().within(() => {
          cy.contains('button', 'Add').click()
          cy.get('input.el-input__inner').type('8080:80')
        })

        cy.get('input[data-testid="oc-input-the_app-image"]').type('nginx:latest')

        cy.wait(500)
      }
    })
  })
})
