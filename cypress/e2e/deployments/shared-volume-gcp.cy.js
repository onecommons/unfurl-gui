const BASE_URL = Cypress.env('OC_URL')
const USERNAME = Cypress.env('OC_IMPERSONATE')
const BASE_TIMEOUT = Cypress.env('BASE_TIMEOUT')


import {deploymentName, deploySharedVolume1, deploySharedVolume2} from '../../support/shared-volume'

describe('GCP shared volume', () => {
  let dep1 = deploymentName('Sharing'), dep2 = deploymentName('Borrowing')
  const fixture = 'generated/deployments/_gcp__nextcloud__volume.json'
  const cardTestId = 'card-google-cloud-compute-persistent-disk'

  it('Can deploy a volume (gcp)', () => {
    deploySharedVolume1(dep1, fixture, cardTestId)
  })

  it('Can share a deployed volume (gcp)', () => {
    deploySharedVolume2(dep2, fixture, cardTestId)
  })

})

