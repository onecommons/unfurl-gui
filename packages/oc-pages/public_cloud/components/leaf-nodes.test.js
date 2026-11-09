jest.mock('oc_vue_shared/components/oc', () => ({DetectIcon: {name: 'DetectIcon', render: () => null}}))
import Deployment from './Deployment.vue'
import Account from './Account.vue'

// d3.hierarchy leaves `children` undefined on a node with none, not empty.
const leaf = {data: {name: 'n', kind: 'deployment'}}

it('lists no resources for a deployment with none', () => {
    expect(Deployment.computed.presentableResources.call({item: leaf})).toEqual([])
})

it('has no first child for an account with no deployments', () => {
    expect(Account.computed.firstChild.call({item: leaf})).toBeNull()
})
