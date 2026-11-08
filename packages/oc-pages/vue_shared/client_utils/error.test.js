import {notFoundError, removeNotFoundError} from './error'

describe('notFoundError', () => {
    beforeEach(() => {
        document.title = 'Dashboard'
        global.fetch = jest.fn().mockResolvedValue({text: () => Promise.resolve('<h1>404</h1>')})
    })

    afterEach(() => {
        document.getElementById('404-overlay')?.remove()
        delete global.fetch
    })

    it('covers the page and sets the title', async () => {
        await notFoundError()
        expect(document.getElementById('404-overlay')).not.toBeNull()
        expect(document.title).toBe('The page you were looking for cannot be found (404)')
    })

    it('removes the overlay and restores the title', async () => {
        await notFoundError('Gone')
        removeNotFoundError()
        expect(document.getElementById('404-overlay')).toBeNull()
        expect(document.title).toBe('Dashboard')
    })

    // PageNotFound unmounts on navigation, which can beat the 404 page's fetch
    it('stays removed when removed before the 404 page has loaded', async () => {
        let respond
        global.fetch = jest.fn(() => new Promise(resolve => { respond = resolve }))

        const shown = notFoundError('Gone')
        removeNotFoundError()
        respond({text: () => Promise.resolve('<h1>404</h1>')})
        await shown

        expect(document.getElementById('404-overlay')).toBeNull()
        expect(document.title).toBe('Dashboard')
    })
})
