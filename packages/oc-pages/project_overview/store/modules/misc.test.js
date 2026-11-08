import {fetchUser} from 'oc_vue_shared/client_utils/user'
import {fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import {createFlash} from 'oc_vue_shared/client_utils/oc-flash'
import misc from './misc'

jest.mock('oc_vue_shared/client_utils/user', () => ({fetchUser: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/projects', () => ({fetchProjectInfo: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/oc-flash', () => ({
    createFlash: jest.fn(), hideLastFlash: jest.fn(), FLASH_TYPES: {NOTICE: 'info'},
}))

const {mutations, actions} = misc

// getters that read other getters, wired the way vuex wires them
function getters(state) {
    const g = {}
    for(const [name, fn] of Object.entries(misc.getters)) {
        Object.defineProperty(g, name, {get: () => fn(state, g), enumerable: true})
    }
    return g
}

beforeEach(() => {
    window.gon = {home_project: 'org/dash', current_username: 'me', current_user_fullname: 'Me Myself'}
    sessionStorage.clear()
    localStorage.clear()
})

describe('state', () => {
    it('starts from the home project in gon', () => {
        expect(misc.state()).toMatchObject({namespace: 'org', dashboard: 'dash', user: null})
    })

    it('has no namespace without a home project', () => {
        window.gon.home_project = null
        expect(misc.state()).toMatchObject({namespace: null, dashboard: null})
    })
})

describe('the home project', () => {
    it('joins the namespace and dashboard', () => {
        const g = getters(misc.state())
        expect(g.getCurrentNamespace).toBe('org')
        expect(g.getHomeProjectPath).toBe('org/dash')
        expect(g.pipelinesPath).toBe('/org/dash/-/pipelines')
    })

    it('falls back to the default namespace, then the user, and the default dashboard', () => {
        const state = {...misc.state(), namespace: null, dashboard: null}
        expect(getters(state).getHomeProjectPath).toBe('me/dashboard')
        localStorage['unfurl_gui:defaultNamespace'] = 'team'
        expect(getters(state).getHomeProjectPath).toBe('team/dashboard')
    })

    // standalone: the server reads an empty path as its one local project
    it('is empty when there is no namespace at all', () => {
        window.gon = {home_project: undefined}
        const state = {...misc.state(), namespace: null}
        expect(getters(state).getHomeProjectPath).toBe('')
    })

    it('is null when gon names no home project', () => {
        window.gon.home_project = null
        const g = getters(misc.state())
        expect(g.getCurrentNamespace).toBeNull()
        expect(g.getHomeProjectPath).toBeNull()
        expect(g.getHomeProjectName).toBeNull()
    })

    it('is named after the project once loaded', async () => {
        const state = misc.state()
        expect(getters(state).getHomeProjectName).toBe('Dashboard')

        fetchProjectInfo.mockResolvedValue({name: 'Team Dash'})
        await actions.populateDashboardProject({commit: (n, p) => mutations[n](state, p), getters: getters(state)})

        expect(fetchProjectInfo).toHaveBeenCalledWith('org%2Fdash')
        expect(getters(state).getHomeProjectName).toBe('Team Dash')
    })

    it('follows the namespace and dashboard mutations', () => {
        const state = misc.state()
        mutations.setCurrentNamespace(state, 'other')
        mutations.setDashboardName(state, 'board')
        expect(getters(state).getHomeProjectPath).toBe('other/board')
    })
})

describe('the user', () => {
    it('reads the name from gon and the record from the api', async () => {
        const state = misc.state()
        fetchUser.mockResolvedValue({id: 1})
        await actions.populateCurrentUser({commit: (n, p) => mutations[n](state, p)})
        expect(getters(state)).toMatchObject({getUsername: 'me', getFullname: 'Me Myself', getUser: {id: 1}})
    })
})

describe('layout', () => {
    it('reports the mobile layout the store holds', () => {
        const state = misc.state()
        mutations.setMobileLayout(state, true)
        expect(getters(state).isMobileLayout).toBe(true)
        mutations.setMobileLayout(state, false)
        expect(getters(state).isMobileLayout).toBe(false)
    })

    it('tracks the window size and scroll', () => {
        const state = misc.state()
        mutations.setWindowWidth(state, 500)
        mutations.setWindowHeight(state, 400)
        mutations.setScrollTop(state, 12)
        expect(getters(state)).toMatchObject({windowWidth: 500, windowHeight: 400, scrollTop: 12})
    })

    it('updates on resize, switching to the mobile layout at 768px', () => {
        jest.useFakeTimers()
        try {
            const state = {...misc.state(), isMobileLayout: false}
            actions.handleResize({commit: (n, p) => mutations[n](state, p), state})

            window.innerWidth = 700
            window.dispatchEvent(new Event('resize'))
            jest.advanceTimersByTime(50)

            expect(state.isMobileLayout).toBe(true)
            expect(state.windowWidth).toBe(700)
        } finally {
            window.innerWidth = 1024
            jest.useRealTimers()
        }
    })
})

describe('the router hook', () => {
    it('defaults to letting navigation through', () => {
        const state = misc.state()
        const next = jest.fn()
        getters(state).getRouterHook(null, null, next)
        expect(next).toHaveBeenCalled()

        const hook = jest.fn()
        mutations.setRouterHook(state, hook)
        expect(getters(state).getRouterHook).toBe(hook)
        mutations.setRouterHook(state, null)
        expect(getters(state).getRouterHook).not.toBe(hook)
    })
})

describe('developer flags', () => {
    it('reads them from the session', () => {
        const g = getters(misc.state())
        expect(g).toMatchObject({UNFURL_MOCK_DEPLOY: false, REVEAL_HIDDEN_TEMPLATES: false, UNFURL_TRACE: false, DEPLOY_IMAGE: 'onecommons/unfurl:latest'})

        sessionStorage['unfurl-mock-deploy'] = '1'
        sessionStorage['reveal-hidden-templates'] = '1'
        sessionStorage['unfurl-trace'] = '1'
        sessionStorage['deploy-image'] = 'img:2'
        sessionStorage['registry-url'] = 'reg.example'

        expect(g).toMatchObject({UNFURL_MOCK_DEPLOY: true, REVEAL_HIDDEN_TEMPLATES: true, UNFURL_TRACE: true, DEPLOY_IMAGE: 'img:2', registryURL: 'reg.example'})
    })
})

describe('createFlash', () => {
    it('files issues against the home project, confidentially', () => {
        const g = getters(misc.state())
        actions.createFlash({getters: g}, 'Saved')
        expect(createFlash).toHaveBeenCalledWith({
            projectPath: 'org/dash', serviceDesk: 'onecommons/support', confidential: true, message: 'Saved', type: 'info',
        })

        actions.createFlash({getters: g}, {message: 'Oops', type: 'danger'})
        expect(createFlash).toHaveBeenLastCalledWith(expect.objectContaining({message: 'Oops', type: 'danger'}))
    })
})
