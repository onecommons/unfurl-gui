const BASE_URL = Cypress.env('OC_URL')
const USERNAME = Cypress.env('OC_IMPERSONATE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')


import {deploymentName, deploySharedVolume1, deploySharedVolume2} from '../../support/shared-volume'

describe('AWS shared volume', () => {
  let dep1 = deploymentName('Sharing'), dep2 = deploymentName('Borrowing')
  const fixture = 'generated/deployments/_aws-20230131t192328579z__nextcloud__volume.json'
  const cardTestId = 'card-aws-elastic-block-storage-volume'

  it('Can deploy a volume (aws)', () => {
    deploySharedVolume1(dep1, fixture, cardTestId)
  })

  it('Can share a deployed volume (aws)', () => {
    deploySharedVolume2(dep2, fixture, cardTestId)
  })

})
