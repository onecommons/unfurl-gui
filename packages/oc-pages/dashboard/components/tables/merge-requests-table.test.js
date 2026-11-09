import {mount} from '@vue/test-utils'
import {h} from 'vue'
import MergeRequestsTable from './merge-requests-table.vue'
import EnvironmentCell from '../cells/environment-cell.vue'

jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))

const TableStub = {
    compatConfig: {MODE: 3},
    props: ['items'],
    render() { return h('div', this.items.map(item => this.$.slots.environment({item}))) },
}

function mountTable(props) {
    const environment = {name: 'env1'}
    const $store = {getters: {
        mergeRequests: [{title: 'mr', labels: ['environment:env1'], author: {name: 'a'}}],
        lookupEnvironment: () => environment,
        getHomeProjectPath: 'me/dashboard',
    }}
    return mount(MergeRequestsTable, {props, global: {mocks: {$store}, stubs: {TableComponent: TableStub, EnvironmentCell: true}, directives: {GlTooltip: {}}}})
}

it('passes noRouter down to its environment links', () => {
    expect(mountTable({noRouter: true}).findComponent(EnvironmentCell).props('noRouter')).toBe(true)
    expect(mountTable({}).findComponent(EnvironmentCell).props('noRouter')).toBe(false)
})
