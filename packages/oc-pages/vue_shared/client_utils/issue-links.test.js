// issues.js (Zendesk) and gitlab-issues.js build the same kind of prefilled link
import {fetchUserPublicEmail} from './user'

jest.mock('./user', () => ({fetchUserPublicEmail: jest.fn()}))

const params = link => Object.fromEntries(new URL(link).searchParams)

describe('generateIssueLink (Zendesk)', () => {
    const {generateIssueLinkSync, generateIssueLink} = require('./issues')

    it('puts the description above the debug info, with title and email', () => {
        const link = generateIssueLinkSync('org/dash', {
            title: 'Broken', description: 'It broke', context: {Deployment: 'app'}, email: 'me@example.com',
        })

        expect(link.startsWith('https://onecommons.zendesk.com/hc/requests/new?')).toBe(true)
        const p = params(link)
        expect(p.tf_subject).toBe('Broken')
        expect(p.tf_anonymous_requester_email).toBe('me@example.com')
        expect(p.tf_description).toMatch(/^It broke<br><br><br><pre>--- Debug info ---<br><br>/)
        expect(p.tf_description).toContain('Deployment: app\n')
        expect(p.tf_description).toContain('Dashboard Project: org/dash\n')
        expect(p.tf_description).toContain(`Referring URL: ${window.location.href}\n`)
        expect(p.tf_description.endsWith('</pre>')).toBe(true)
    })

    it('is just the debug info without a description, and leaves out an empty project', () => {
        const p = params(generateIssueLinkSync(null, {}))
        expect(p.tf_description.startsWith('<pre>Referring URL:')).toBe(true)
        expect(p.tf_description).not.toContain('Dashboard Project')
        expect(p).not.toHaveProperty('tf_subject')
        expect(p).not.toHaveProperty('tf_anonymous_requester_email')
    })

    it('fills in the user\'s public email', async () => {
        fetchUserPublicEmail.mockResolvedValue('me@example.com')
        expect(params(await generateIssueLink('org/dash', {title: 'T'})).tf_anonymous_requester_email).toBe('me@example.com')
    })
})

describe('generateGitLabIssueSync', () => {
    let generateGitLabIssueSync
    beforeAll(() => {
        window.gon = {}
        jest.isolateModules(() => { ({generateGitLabIssueSync} = require('./gitlab-issues')) })
    })

    it('opens a new issue on the project with the debug info fenced', () => {
        const link = generateGitLabIssueSync('org/dash', {
            title: 'Broken', description: 'It broke', context: {Deployment: 'app'}, confidential: true,
        })

        expect(link.startsWith(`${window.origin}/org/dash/-/issues/new?`)).toBe(true)
        const p = params(link)
        expect(p['issue[title]']).toBe('Broken')
        expect(p['issue[confidential]']).toBe('true')
        expect(p['issue[description]']).toMatch(/^It broke\n\n\n```\n--- Debug info ---\n\n/)
        expect(p['issue[description]']).toContain('Deployment: app\n')
        expect(p['issue[description]'].endsWith('```')).toBe(true)
    })

    it('files on the service desk project when there is one', () => {
        expect(generateGitLabIssueSync('org/dash', {serviceDesk: 'org/support'}))
            .toContain('/org/support/-/issues/new?')
    })

    it('leaves out title and confidentiality when not given', () => {
        const p = params(generateGitLabIssueSync('org/dash', {}))
        expect(p['issue[description]'].startsWith('```Referring URL:')).toBe(true)
        expect(p).not.toHaveProperty('issue[title]')
        expect(p).not.toHaveProperty('issue[confidential]')
    })

    it('links to the GitLab instance from standalone', () => {
        window.gon = {unfurl_gui: true, gitlab_url: 'https://gitlab.example'}
        let fromStandalone
        jest.isolateModules(() => { fromStandalone = require('./gitlab-issues').generateGitLabIssueSync })
        expect(fromStandalone('org/dash', {})).toContain('https://gitlab.example/org/dash/-/issues/new?')
        window.gon = {}
    })
})
