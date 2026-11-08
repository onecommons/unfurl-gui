import {createAlert} from '~/alert'
import createFlash, {FLASH_TYPES} from './oc-flash'

jest.mock('~/alert', () => ({
    createAlert: jest.fn(),
    VARIANT_DANGER: 'danger', VARIANT_SUCCESS: 'success', VARIANT_WARNING: 'warning', VARIANT_INFO: 'info',
}))

// what both alert implementations hand back: the alert inside a container
function renderedAlert() {
    const container = document.createElement('div')
    const alert = document.createElement('div')
    const content = document.createElement('div')
    content.className = 'gl-alert-content'
    alert.appendChild(content)
    container.appendChild(alert)
    document.body.appendChild(container)
    return {$el: alert}
}

const nextFrame = () => new Promise(resolve => window.requestAnimationFrame(() => setTimeout(resolve)))

beforeEach(() => {
    document.body.replaceChildren()
    window.gon = {}
    createAlert.mockImplementation(renderedAlert)
})

it('maps flash types to alert variants', () => {
    expect(FLASH_TYPES).toEqual({ALERT: 'danger', SUCCESS: 'success', WARNING: 'warning', NOTICE: 'info'})
})

it('shows a message with the given variant, full width', () => {
    const el = createFlash('Saved', {type: FLASH_TYPES.SUCCESS})
    expect(createAlert).toHaveBeenCalledWith({message: 'Saved', type: 'success', variant: 'success'})
    expect(el.parentNode.style.maxWidth).toBe('100%')
})

it('renders nothing for an empty message', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(createFlash({message: ''})).toBeNull()
    expect(createAlert).not.toHaveBeenCalled()
    error.mockRestore()
})

// standalone's createAlert answers null when the page has no flash container
it('renders nothing when there is nowhere to show it', () => {
    createAlert.mockReturnValue(null)
    expect(createFlash('Saved')).toBeNull()
})

it('adds a link', async () => {
    const el = createFlash({message: 'Done', linkTo: '/somewhere', linkText: 'Go'})
    await nextFrame()
    const link = el.querySelector('a')
    expect(link.textContent).toBe('Go')
    expect(link.getAttribute('href')).toBe('/somewhere')
    expect(link.target).toBe('_blank')
})

it('offers to file an issue for an error', async () => {
    const el = createFlash({message: 'It failed', type: FLASH_TYPES.ALERT, projectPath: 'org/dash', issue: 'Deploy failed'})
    await nextFrame()
    const link = el.querySelector('.gl-alert-content a')
    expect(link.textContent).toBe('Click to create an issue: Deploy failed')
    expect(link.getAttribute('href')).toContain('/org/dash/-/issues/new?')
    expect(decodeURIComponent(link.getAttribute('href'))).toContain('It failed')
})

it('treats a flash with an issue as an error', () => {
    createFlash({message: 'It failed', issue: 'x'})
    expect(createAlert.mock.calls[0][0].variant).toBe('danger')
})
