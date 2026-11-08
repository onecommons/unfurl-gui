// commits, unfurl-invocations, resource_types and gitlab-chrome
import axios from '~/lib/utils/axios_utils'
import {getOrFetchDefaultBranch} from './projects'
import {deleteFiles} from './commits'
import {unfurl_cloud_vars_url, cloneProject, cloneBlueprint} from './unfurl-invocations'
import {isDiscoverable, isConfigurable} from './resource_types'
import {headerBounds, settingsIndicatorAnchor} from './gitlab-chrome'

jest.mock('~/lib/utils/axios_utils', () => ({__esModule: true, default: {post: jest.fn()}}))
jest.mock('./projects', () => ({getOrFetchDefaultBranch: jest.fn()}))

// jest.config resets mock implementations before each test
beforeEach(() => {
    getOrFetchDefaultBranch.mockResolvedValue('main')
    window.gon = {}
    document.body.replaceChildren()
})

describe('deleteFiles', () => {
    it('commits the deletions to the default branch', async () => {
        axios.post.mockResolvedValue({status: 201, data: {id: 'c1'}})

        await expect(deleteFiles(7, ['a.yaml', 'b.yaml'], {})).resolves.toEqual({id: 'c1'})

        expect(getOrFetchDefaultBranch).toHaveBeenCalledWith(7)
        expect(axios.post).toHaveBeenCalledWith('/api/v4/projects/7/repository/commits', {
            branch: 'main',
            commit_message: 'Delete deployment records',
            actions: [{file_path: 'a.yaml', action: 'delete'}, {file_path: 'b.yaml', action: 'delete'}],
        }, undefined)
    })

    it('uses a token, and then reads the failure itself', async () => {
        axios.post.mockResolvedValue({status: 400, data: {message: 'A file with this name doesn\'t exist'}})

        await expect(deleteFiles(7, ['a.yaml'], {accessToken: 'tok', branch: 'dev', commitMessage: 'Bye'}))
            .rejects.toThrow('A file with this name doesn\'t exist')

        const [, payload, config] = axios.post.mock.calls[0]
        expect(payload).toMatchObject({branch: 'dev', commit_message: 'Bye'})
        expect(config.headers).toEqual({'PRIVATE-TOKEN': 'tok'})
        expect(config.validateStatus(500)).toBe(true)
    })

    it('is refused in standalone', async () => {
        window.gon.unfurl_gui = true
        await expect(deleteFiles(7, ['a.yaml'], {})).rejects.toThrow('unsupported in standalone')
    })
})

describe('unfurl command lines', () => {
    const server = {protocol: 'https:', server: 'unfurl.cloud', projectId: 7}

    it('clones a project with credentials and its variables url', () => {
        expect(cloneProject({...server, username: 'me', token: 'tok', projectPath: 'org/dash'})).toBe(
            "unfurl clone 'https://me:tok@unfurl.cloud/org/dash' --var UNFURL_CLOUD_VARS_URL " +
            "'https://unfurl.cloud/api/v4/projects/7/variables?per_page=1000&private_token=tok'"
        )
    })

    it('clones without credentials when there is no token', () => {
        expect(cloneProject({...server, username: 'me', projectPath: 'org/dash'})).toBe("unfurl clone 'https://unfurl.cloud/org/dash'")
    })

    it('builds the variables url', () => {
        expect(unfurl_cloud_vars_url({...server, token: 't'})).toBe('https://unfurl.cloud/api/v4/projects/7/variables?per_page=1000&private_token=t')
    })

    it('clones a blueprint into a deployment', () => {
        expect(cloneBlueprint({
            projectName: 'dash', environmentName: 'prod', deploymentName: 'app', deployPath: 'environments/prod/app', blueprintUrl: 'https://x/bp',
        })).toBe('cd dash; unfurl clone --existing --overwrite --mono --use-environment prod --use-deployment-blueprint app --skeleton dashboard https://x/bp environments/prod/app')
    })
})

describe('resource type availability', () => {
    const types = {
        'unfurl.relationships.ConnectsTo.AWSAccount': {name: 'AWSAccount', extends: ['unfurl.relationships.ConnectsTo.AWSAccount', 'unfurl.relationships.ConnectsTo.CloudAccount']},
        'unfurl.relationships.ConnectsTo.ComputeMachines': {name: 'ComputeMachines', extends: ['unfurl.relationships.ConnectsTo.ComputeMachines']},
        'Legacy': {name: 'Legacy', metadata: {deprecates: ['unfurl.relationships.ConnectsTo.CloudAccount']}},
    }
    const resolve = name => types[name]
    const aws = {connections: {primary_provider: {type: 'unfurl.relationships.ConnectsTo.AWSAccount'}}}

    it('is discoverable with a connect implementation and its requirements met', () => {
        const rt = {implementations: ['connect'], implementation_requirements: ['unfurl.relationships.ConnectsTo.CloudAccount']}
        expect(isDiscoverable(rt, aws, resolve)).toBe(true)
        expect(isConfigurable(rt, aws, resolve)).toBe(true)
    })

    it('is configurable with create or configure', () => {
        expect(isConfigurable({implementations: ['create']}, aws, resolve)).toBe(true)
        expect(isConfigurable({implementations: ['configure']}, aws, resolve)).toBe(true)
        expect(isConfigurable({implementations: ['delete']}, aws, resolve)).toBe(false)
        expect(isDiscoverable({implementations: ['create']}, aws, resolve)).toBe(false)
    })

    it('is neither when the environment cannot meet a requirement', () => {
        const rt = {implementations: ['connect', 'create'], implementation_requirements: ['unfurl.relationships.ConnectsTo.GoogleCloudProject']}
        expect(isDiscoverable(rt, aws, resolve)).toBe(false)
        expect(isConfigurable(rt, aws, resolve)).toBe(false)
    })

    it('treats an environment with no connections as generic compute', () => {
        const rt = {implementations: ['create'], implementation_requirements: ['unfurl.relationships.ConnectsTo.ComputeMachines']}
        expect(isConfigurable(rt, {connections: {}}, resolve)).toBe(true)
        // no environment: requirements are not checked at all
        expect(isConfigurable({...rt, implementation_requirements: ['anything']}, null, resolve)).toBe(true)
    })

    it('accepts a connection whose type deprecates the requirement', () => {
        const rt = {implementations: ['create'], implementation_requirements: ['unfurl.relationships.ConnectsTo.CloudAccount']}
        expect(isConfigurable(rt, {connections: {p: {type: 'Legacy'}}}, resolve)).toBe(true)
    })

    // the type of a connection imported from a repository not loaded yet
    it('treats a connection of unknown type as not meeting a requirement', () => {
        const rt = {implementations: ['create'], implementation_requirements: ['Legacy']}
        expect(isConfigurable(rt, {connections: {p: {type: 'NotLoaded'}}}, resolve)).toBe(false)
    })
})

describe('gitlab-chrome', () => {
    const mount = (tag, attributes, rect, child) => {
        const el = document.createElement(tag)
        Object.entries(attributes).forEach(([name, value]) => el.setAttribute(name, value))
        if(child) el.appendChild(child)
        el.getBoundingClientRect = () => rect
        document.body.appendChild(el)
        return el
    }

    it('is a zero rect without a header', () => {
        expect(headerBounds()).toMatchObject({x: 0, y: 0, right: 0, bottom: 0})
        expect(settingsIndicatorAnchor()).toEqual({x: -8, y: 0})
    })

    it('finds the 19.x header', () => {
        mount('header', {class: 'js-super-topbar'}, {right: 1000, bottom: 48})
        expect(headerBounds()).toEqual({right: 1000, bottom: 48})
        expect(settingsIndicatorAnchor()).toEqual({x: 992, y: 48})
    })

    it('anchors to the 15.11 navbar\'s content box', () => {
        const inner = document.createElement('div')
        inner.className = 'navbar-collapse collapse'
        inner.getBoundingClientRect = () => ({x: 200, y: 10})
        mount('div', {'data-qa-selector': 'navbar'}, {right: 1000, bottom: 48}, inner)
        expect(settingsIndicatorAnchor()).toEqual({x: 200, y: 10})
    })
})
