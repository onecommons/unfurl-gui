import axios from '~/lib/utils/axios_utils'
import {projectPathToHomeRoute} from './dashboard'
import {parseMarkdown} from './markdown'
import {postFormDataWithEntries} from './forms'
import {generateGroupAccessToken} from './group'

jest.mock('~/lib/utils/axios_utils', () => ({
    __esModule: true,
    default: {post: jest.fn()},
}))

afterEach(() => axios.post.mockReset())

describe('projectPathToHomeRoute', () => {
    it('prefixes a project path with /', () => {
        expect(projectPathToHomeRoute('org/dash')).toBe('/org/dash')
    })

    it.each(['local:/home/me/proj', '', null, undefined])('is empty for %p', (path) => {
        expect(projectPathToHomeRoute(path)).toBe('')
    })
})

describe('parseMarkdown', () => {
    it.each(['', null, undefined])('is empty for %p', (input) => {
        expect(parseMarkdown(input)).toBe('')
    })

    it('renders markdown and opens links in a new tab', () => {
        const html = parseMarkdown('**bold** [x](https://example.com)')
        expect(html).toContain('bold')
        expect(html).toContain('href="https://example.com"')
        expect(html).toContain('target="_blank"')
        expect(html).toContain('rel="noopener noreferrer"')
    })

    it('strips scripts and event handlers', () => {
        const html = parseMarkdown('<script>alert(1)</script><img src=x onerror=alert(1)>hi')
        expect(html).not.toContain('<script')
        expect(html).not.toContain('onerror')
        expect(html).toContain('hi')
    })

    it('keeps the markup markdown produces', () => {
        const html = parseMarkdown('# Title\n\n- one\n- two\n\n`code`')
        expect(html).toContain('<h1')
        expect(html).toContain('<li>one</li>')
        expect(html).toContain('<code>code</code>')
    })
})

describe('postFormDataWithEntries', () => {
    it('posts the entries as FormData with the given headers', async () => {
        axios.post.mockResolvedValue({data: 'ok'})
        await postFormDataWithEntries('/upload', [['a', '1'], ['b', '2']], {'X-Test': 'y'})

        const [url, body, config] = axios.post.mock.calls[0]
        expect(url).toBe('/upload')
        expect(body).toBeInstanceOf(FormData)
        expect([...body.entries()]).toEqual([['a', '1'], ['b', '2']])
        expect(config).toEqual({headers: {'X-Test': 'y'}})
    })
})

describe('generateGroupAccessToken', () => {
    it('requests a maintainer token with the default scopes', async () => {
        axios.post.mockResolvedValue({data: {token: 'glpat-x'}})
        await expect(generateGroupAccessToken('ci', 'org/sub')).resolves.toBe('glpat-x')
        expect(axios.post).toHaveBeenCalledWith('/api/v4/groups/org%2Fsub/access_tokens', {
            id: 'org/sub',
            name: 'ci',
            scopes: ['read_registry', 'read_repository'],
            access_level: 40,
            expires_at: '',
        })
    })

    it('overrides scopes and expiry from options', async () => {
        axios.post.mockResolvedValue({data: {token: 't'}})
        await generateGroupAccessToken('ci', 7, {scopes: ['api'], expiresAt: '2027-01-01'})
        expect(axios.post.mock.calls[0][1]).toMatchObject({scopes: ['api'], expires_at: '2027-01-01'})
    })
})
