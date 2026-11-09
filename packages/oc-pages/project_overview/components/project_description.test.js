import {shallowMount} from '@vue/test-utils'
import Vuex from 'vuex'
import ProjectDescriptionBox from './project_description.vue'

jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))

// The blueprint page's Details tab lists the primary type's inputs and outputs.
it("lists the primary type's inputs and outputs", () => {
    const store = new Vuex.Store({
        state: {project: {globalVars: {}}},
        getters: {
            getDisplayableDependenciesByCard: () => () => [], getPrimaryCard: () => ({}),
            resolveResourceTypeFromAny: () => () => null, requirementsForType: () => () => [],
            getProjectDescription: () => '',
            inputsSchemaForType: () => () => ({properties: {domain: {title: 'Domain'}}}),
            outputsSchemaForType: () => () => ({properties: {url: {title: 'URL'}, ip: {title: 'IP'}}}),
        },
    })
    const wrapper = shallowMount(ProjectDescriptionBox, {
        props: {projectInfo: {primary: 'App', title: 'App'}},
        global: {plugins: [store], mocks: {__: s => s}},
    })

    expect(wrapper.vm.inputs).toHaveLength(1)
    expect(wrapper.vm.outputs).toHaveLength(2)
})
