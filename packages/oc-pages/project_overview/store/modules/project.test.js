import axios from '~/lib/utils/axios_utils'
import {lookupNumberOfComments} from 'oc_vue_shared/client_utils/comments'
import project from './project'

jest.mock('~/lib/utils/axios_utils', () => ({__esModule: true, default: {get: jest.fn()}}))
jest.mock('oc_vue_shared/client_utils/comments', () => ({lookupNumberOfComments: jest.fn()}))

const {mutations, actions, getters} = project

function context(state = project.state(), rootGetters = {}) {
    return {state, rootGetters, commit: jest.fn((name, payload) => mutations[name](state, payload))}
}

afterEach(() => {
    delete global.fetch
    document.body.replaceChildren()
})

describe('global vars', () => {
    it('stores them with the project icon from the page', () => {
        const wrapper = document.createElement('div')
        wrapper.id = 'oc-project-overview-icon'
        const img = document.createElement('img')
        img.setAttribute('data-src', '/icon.png')
        wrapper.appendChild(img)
        document.body.appendChild(wrapper)

        const ctx = context()
        actions.syncGlobalVars(ctx, {projectPath: 'org/bp'})

        expect(getters.getGlobalVars(ctx.state)).toEqual({projectPath: 'org/bp', projectIcon: '/icon.png'})
    })

    it('describes the project from its vars, or else its blueprint', () => {
        const state = {...project.state(), globalVars: {projectDescription: 'From vars'}}
        const rootGetters = {getApplicationBlueprint: {description: 'From blueprint'}}
        expect(getters.getProjectDescription(state, {}, {}, rootGetters)).toBe('From vars')
        expect(getters.getProjectDescription(project.state(), {}, {}, rootGetters)).toBe('From blueprint')
    })
})

it('records the selected requirement', () => {
    const ctx = context()
    actions.setRequirementSelected(ctx, {requirement: {name: 'db'}, titleKey: 'Database'})
    expect(getters.getRequirementSelected(ctx.state)).toEqual({requirement: {name: 'db'}, titleKey: 'Database'})
})

describe('fetchCloudmap', () => {
    const cloudmap = {
        type: 'root',
        children: [
            {type: 'group', name: 'aws', children: [
                {type: 'app', name: 'wp-aws', children: [{resourceType: 'WordPress'}]},
                {type: 'app', name: 'other', children: [{resourceType: 'Ghost'}]},
            ]},
            {type: 'group', name: 'gcp', children: [
                {type: 'app', name: 'wp-gcp', children: [{resourceType: 'WordPress'}]},
            ]},
        ],
    }

    it('lists the cloudmap apps running this blueprint\'s primary type, with their testbed', async () => {
        global.fetch = jest.fn(async () => ({json: async () => cloudmap}))
        const ctx = context({...project.state(), globalVars: {cloudmap: 'https://cloudmap/map.json'}}, {getApplicationBlueprint: {primary: 'WordPress'}})

        await actions.fetchCloudmap(ctx)

        expect(global.fetch).toHaveBeenCalledWith('https://cloudmap/map.json')
        const apps = getters.openCloudDeployments(ctx.state)
        expect(apps.map(a => a.name)).toEqual(['wp-aws', 'wp-gcp'])
        expect(apps[0]).toEqual({type: 'app', name: 'wp-aws', testbed: {type: 'group', name: 'aws'}})
    })

    it('does nothing without a cloudmap', async () => {
        global.fetch = jest.fn()
        const ctx = context()
        await actions.fetchCloudmap(ctx)
        expect(global.fetch).not.toHaveBeenCalled()
    })
})

describe('fetchCommentsIssue', () => {
    // jest does not run the `#!if` preprocessor, so this is the fork's path
    it('counts the comments on the open general discussion issue', async () => {
        axios.get.mockResolvedValue({data: [{web_url: '/org/bp/-/issues/1'}]})
        lookupNumberOfComments.mockResolvedValue(4)
        const ctx = context({...project.state(), globalVars: {projectPath: 'org/bp'}})

        await actions.fetchCommentsIssue(ctx)

        expect(axios.get).toHaveBeenCalledWith('/api/v4/projects/org%2Fbp/issues?state=opened&label=general+discussion')
        expect(getters.commentsIssueUrl(ctx.state)).toBe('/org/bp/-/issues/1')
        expect(getters.commentsCount(ctx.state)).toBe(4)
    })

    it('leaves the count unset without such an issue', async () => {
        axios.get.mockResolvedValue({data: []})
        const ctx = context({...project.state(), globalVars: {projectPath: 'org/bp'}})
        await actions.fetchCommentsIssue(ctx)
        expect(getters.commentsCount(ctx.state)).toBeNull()
    })
})

describe('yourDeployments', () => {
    const dict = (extra = {}) => ({
        _environment: 'prod',
        DeploymentTemplate: {dt: {name: 'dt', projectPath: 'org/bp'}},
        ApplicationBlueprint: {bp: {name: 'bp'}},
        Deployment: {app: {name: 'app', primary: 'web'}},
        Resource: {web: {name: 'web'}, db: {name: 'db'}, secret: {name: 'secret', visibility: 'hidden'}},
        ...extra,
    })
    const yourDeployments = (dicts, projectPath = 'org/bp') => getters.yourDeployments(
        {...project.state(), globalVars: {projectPath}}, {}, {},
        {getDeploymentDictionaries: dicts, lookupEnvironment: name => ({name})},
    )

    it('lists a row per visible resource of this blueprint\'s deployments', () => {
        const rows = yourDeployments([dict()])
        expect(rows.map(r => r.resource.name)).toEqual(['web', 'db'])
        expect(rows[0]).toMatchObject({
            environment: {name: 'prod'},
            application: {name: 'bp'},
            deployment: {name: 'app', projectPath: 'org/bp', statuses: [{name: 'web'}]},
        })
        expect(rows[0].context).toEqual({environment: rows[0].environment, application: rows[0].application, deployment: rows[0].deployment, resource: rows[0].resource})
    })

    it('lists a draft once, by its template', () => {
        const rows = yourDeployments([dict({Deployment: undefined})])
        expect(rows).toHaveLength(1)
        expect(rows[0].deployment).toEqual({name: 'dt', projectPath: 'org/bp'})
        expect(rows[0]).not.toHaveProperty('resource')
    })

    it('leaves out other blueprints\' deployments and malformed ones', () => {
        const error = jest.spyOn(console, 'error').mockImplementation(() => {})
        expect(yourDeployments([dict()], 'org/other')).toEqual([])
        expect(yourDeployments([{_environment: 'prod'}])).toEqual([])
        expect(yourDeployments([dict({ApplicationBlueprint: undefined})])).toEqual([])
        error.mockRestore()
    })
})
