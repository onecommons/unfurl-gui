import {deploymentNames, deploySharedVolume1, deploySharedVolume2} from '../../support/shared-volume'

describe('AWS shared volume', () => {
  const [dep1, dep2] = deploymentNames('Sharing', 'Borrowing')
  const fixture = 'generated/deployments/_aws-20230131t192328579z__nextcloud__volume.json'
  const cardTestId = 'card-aws-elastic-block-storage-volume'

  it('Can deploy a volume (aws)', () => {
    deploySharedVolume1(dep1, fixture, cardTestId)
  })

  it('Can share a deployed volume (aws)', () => {
    deploySharedVolume2(dep1, dep2, fixture, cardTestId)
  })

})
