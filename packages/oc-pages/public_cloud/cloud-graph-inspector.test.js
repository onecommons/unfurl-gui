import CloudGraphInspector from './cloud-graph-inspector.vue'
import { mount } from '@vue/test-utils'
import graph from './cloud-graph-inspector-mock.data.json'

// @gitlab/ui ships untransformed esm and jest does not transpile node_modules here; these
// two only need to pass their slots through for the inspector to render. render functions
// rather than templates, because jest resolves vue to the runtime-only build
jest.mock('@gitlab/ui', () => ({
    GlCard: {
        render(h) {
            return h('div', [this.$slots.header, this.$slots.default])
        }
    },
    GlBadge: {
        render(h) {
            return h('span', this.$slots.default)
        }
    },
}))

const ROOT_URL = graph.roots[0].url

// the inspector reads window.location.hash in created(), so the hash has to be set first
function mountAt(hash) {
    window.location.hash = hash
    return mount(CloudGraphInspector, {propsData: {graph}})
}

// .group-toggle is the top level of the stack; nested subgroups reuse .group-label under
// .subgroup-toggle, so match on the toggle to keep this to one level
function groupLabels(wrapper) {
    return wrapper.findAll('.group-toggle .group-label').map(w => w.text())
}

function isOverview(wrapper) {
    return !wrapper.find('.focus-url').exists()
}

test('shows the overview when the hash carries no url', () => {
    const wrapper = mountAt('#graph=')

    expect(isOverview(wrapper)).toBe(true)
    expect(groupLabels(wrapper)).toEqual(graph.roots.map(root => root.kind))
})

test('falls back to the overview when the hash names an unknown url', () => {
    // an unknown url has no relations to draw, and an empty focus view reads as a broken one
    const wrapper = mountAt('#graph=root')

    expect(isOverview(wrapper)).toBe(true)
    expect(groupLabels(wrapper)).toEqual(graph.roots.map(root => root.kind))
})

test('survives a hash with malformed escapes', () => {
    // decodeURIComponent throws on a bare '%'
    const wrapper = mountAt('#graph=%')

    expect(isOverview(wrapper)).toBe(true)
})

test('focuses the node the hash names', () => {
    const wrapper = mountAt(`#graph=${encodeURIComponent(ROOT_URL)}`)

    expect(wrapper.find('.focus-url').text()).toEqual(ROOT_URL)
    expect(groupLabels(wrapper)).toEqual(['source', 'instantiated', 'inputs'])
})

test('the focus view can get back to the overview', async () => {
    const wrapper = mountAt(`#graph=${encodeURIComponent(ROOT_URL)}`)

    await wrapper.find('.focus-back').trigger('click')

    expect(isOverview(wrapper)).toBe(true)
    expect(window.location.hash).toEqual('#graph=')
})

test('re-selecting the focused node does not stack history entries', () => {
    const wrapper = mountAt(`#graph=${encodeURIComponent(ROOT_URL)}`)
    const pushState = jest.spyOn(window.history, 'pushState')

    wrapper.vm.selectUrl(ROOT_URL, wrapper.vm.selectedKind)

    expect(pushState).not.toHaveBeenCalled()
})
