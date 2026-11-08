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
})
