jest.mock('@gitlab/ui', () => ({GlModal: {name: 'GlModal', render: () => null}}))
jest.mock('oc_vue_shared/compat', () => ({compatibilityUnfurlBadgeUrlBuilder: jest.fn()}))

window.gon = {unfurl_gui: true}
const OverviewShareModal = require('./overview-share-modal.vue').default

// The badge builder's query is not guaranteed to hold a key=value pair.
it('titles the page when the button params hold no key=value pair', () => {
    document.head.innerHTML = '<title></title>'
    const self = {visible: true, baseTitle: 'Project', encodedButtonParams: '?flag'}
    OverviewShareModal.methods.updateTitle.call(self)
    expect(document.title).toBe('Project Share ()')
})
