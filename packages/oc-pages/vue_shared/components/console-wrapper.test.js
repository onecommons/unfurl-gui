import {shallowMount, flushPromises} from '@vue/test-utils'
import {compatibilityMountJobConsole, compatibilityUnmountJobConsole} from 'oc_vue_shared/compat'
import ConsoleWrapper from './console-wrapper.vue'

jest.mock('oc_vue_shared/compat', () => ({
    compatibilityMountJobConsole: jest.fn(),
    compatibilityUnmountJobConsole: jest.fn(),
}))

function mountConsole() {
    const $store = {
        getters: new Proxy({windowHeight: 800}, {has: () => true, get: (t, k) => t[k]}),
        dispatch: jest.fn(),
        commit: jest.fn(),
    }
    return shallowMount(ConsoleWrapper, {
        props: {jobsData: [{web_url: '/org/dash/-/jobs/1'}]},
        global: {mocks: {$store, $route: {hash: ''}}},
        attachTo: document.body,
    })
}

// mounted reads the job page's markup before mounting the console into it
beforeEach(() => {
    jest.useFakeTimers()
    global.fetch = jest.fn(() => Promise.resolve({text: () => Promise.resolve('<div id="js-job-page" data-endpoint="/x"></div>')}))
})
afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
})

describe('leaving the page', () => {
    it('stops polling when there is no console app, as in standalone', async () => {
        compatibilityMountJobConsole.mockResolvedValue(undefined)
        const wrapper = mountConsole()
        await flushPromises()
        expect(jest.getTimerCount()).toBeGreaterThan(0)

        wrapper.unmount()
        expect(compatibilityUnmountJobConsole).toHaveBeenCalledWith(undefined)
        expect(jest.getTimerCount()).toBe(0)
    })

    it('tears down the console app it mounted, and stops polling', async () => {
        const app = {$store: {state: {}}}
        compatibilityMountJobConsole.mockResolvedValue(app)
        const wrapper = mountConsole()
        await flushPromises()

        wrapper.unmount()
        expect(compatibilityUnmountJobConsole).toHaveBeenCalledWith(app)
        expect(jest.getTimerCount()).toBe(0)
    })
})
