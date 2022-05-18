import slugify from '../../packages/oc-pages/vue_shared/slugify'
describe('verify deployment', () => {
  it('a', () => {
    cy.fixture('generated/deployments/_staging-aws__ghost__ghost').then(deployment => {
      const {DefaultTemplate, DeploymentTemplate, DeploymentPath, ResourceTemplate} = deployment
      const dt = Object.values(DeploymentTemplate)[0]
      const dp = Object.values(deployment.DeploymentPath)[0]
      dt.title = 'Cy ghost l3app8oe'
      dt.name = slugify(dt.title)
      dp.environment = 'aws-2022-05-17t19-05-43'

      cy.verifyDeployment(deployment)
    })
  })
})

