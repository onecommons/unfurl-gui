import {createApp, h} from 'vue'

// input-modality installs once per module, so each test loads its own
let mountReplacing, trackInputModality
beforeEach(() => {
    jest.isolateModules(() => {
        ({mountReplacing} = require('./mount-app'))
        ;({trackInputModality} = require('./input-modality'))
    })
    document.body.replaceChildren()
    document.documentElement.removeAttribute('data-input-modality')
})

describe('mountReplacing', () => {
    it('renders the app in place of the target, with no wrapper left', () => {
        const before = document.createElement('p')
        const target = document.createElement('div')
        target.id = 'app'
        document.body.append(before, target)

        const vm = mountReplacing(createApp({render: () => h('main', {class: 'root'}, 'hi')}), target)

        expect(document.getElementById('app')).toBeNull()
        expect(document.body.children).toHaveLength(2)
        expect(document.body.children[1].outerHTML).toBe('<main class="root">hi</main>')
        expect(vm).toBeDefined()
    })

    it('starts tracking input modality', () => {
        const target = document.createElement('div')
        document.body.append(target)
        mountReplacing(createApp({render: () => h('div')}), target)
        expect(document.documentElement.dataset.inputModality).toBe('pointer')
    })
})

describe('trackInputModality', () => {
    const key = key => document.dispatchEvent(new KeyboardEvent('keydown', {key}))

    it('switches to keyboard on navigation keys and back on a pointer', () => {
        trackInputModality()
        key('a')
        expect(document.documentElement.dataset.inputModality).toBe('pointer')
        key('Tab')
        expect(document.documentElement.dataset.inputModality).toBe('keyboard')
        document.dispatchEvent(new Event('pointerdown'))
        expect(document.documentElement.dataset.inputModality).toBe('pointer')
    })

    it('installs once', () => {
        const add = jest.spyOn(document, 'addEventListener')
        trackInputModality()
        trackInputModality()
        expect(add).toHaveBeenCalledTimes(2)
        add.mockRestore()
    })
})
