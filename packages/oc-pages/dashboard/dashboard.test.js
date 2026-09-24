// @gitlab/ui ships untransformed esm that jest does not transpile out of
// node_modules, and importing the SFC pulls it in
jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true

        const props = new Proxy({}, {get: () => ({validator: () => true})})

        return {name, props, render: () => null}
    },
}))

import {pollableDashboardItem} from './dashboard.vue'

const environment = {name: 'do3'}
const deployment = {name: 'minecraft'}

describe('pollableDashboardItem', () => {
    it('accepts an item with both halves', () => {
        expect(pollableDashboardItem({deployment, environment})).toBe(true)
    })

    // table_data builds a row for every environment, and sets deployment to
    // null on the ones with nothing deployed. There is no url to poll there,
    // and asking anyway is what filled the console.
    it('rejects the row an empty environment gets', () => {
        expect(pollableDashboardItem({deployment: null, environment})).toBe(false)
    })

    it('rejects an item still missing its environment', () => {
        expect(pollableDashboardItem({deployment, environment: null})).toBe(false)
    })

    it('rejects nothing at all', () => {
        expect(pollableDashboardItem(undefined)).toBe(false)
    })
})
