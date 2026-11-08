// The page builds a d3 bubble chart and mounts three Vue apps into the page's
// own markup. jsdom has no layout, so this checks what gets built and wired,
// not where anything lands.
import initPublicCloud from './index'
import getData from './raw-data'

// @gitlab/ui ships untransformed esm that jest does not transpile out of node_modules
jest.mock('@gitlab/ui', () => {
    const {h} = require('vue')
    return new Proxy({}, {
        get(_target, name) {
            if(typeof name != 'string') return undefined
            if(name == '__esModule') return true
            const props = new Proxy({}, {get: () => ({validator: () => true})})
            // a compat-mode parent may hand over slot content as an array
            const render = function() {
                const content = this.$slots.default
                return h('div', typeof content == 'function' ? content() : content)
            }
            return {name, props, render}
        },
    })
})

jest.mock('./raw-data', () => ({__esModule: true, default: jest.fn()}))

// jsdom implements no SVG geometry, which d3-zoom reads the extent from, and no
// document.scrollingElement, which every browser has
beforeAll(() => {
    Object.defineProperty(document, 'scrollingElement', {configurable: true, get: () => document.documentElement})
    const length = (name, fallback) => function() {
        return {baseVal: {value: Number(this.getAttribute(name)) || fallback}}
    }
    Object.defineProperties(SVGSVGElement.prototype, {
        width: {configurable: true, get: length('width', 800)},
        height: {configurable: true, get: length('height', 600)},
        viewBox: {configurable: true, get() {
            const [x, y, width, height] = (this.getAttribute('viewBox') || '0 0 800 600').split(/[\s,]+/).map(Number)
            return {baseVal: {x, y, width, height}}
        }},
    })
})

afterAll(() => {
    for(const name of ['width', 'height', 'viewBox']) delete SVGSVGElement.prototype[name]
    delete document.scrollingElement
})

function pageMarkup() {
    document.body.replaceChildren()
    const el = (tag, id, parent = document.body) => {
        const node = document.createElement(tag)
        if(id) node.id = id
        parent.appendChild(node)
        return node
    }
    // jsdom does no layout; the chart sizes itself to its pane
    const rect = (top, width, height) => () => ({top, left: 0, width, height, bottom: top + height, right: width})
    const layout = el('div', 'public-cloud-layout')
    layout.getBoundingClientRect = rect(0, 800, 1000)
    const pane = el('div', 'public-cloud-chart-pane', layout)
    pane.getBoundingClientRect = rect(0, 800, 600)
    const chart = el('div', 'chart', pane)
    el('div', 'map-controls', chart)
    el('div', 'cloud-splitter', layout).getBoundingClientRect = rect(600, 800, 10)
    el('div', 'cloud-table', layout)
    el('div', 'tooltip')
    return {layout, chart}
}

beforeEach(() => {
    // formatted-data mutates the payload, so each test gets its own copy
    getData.mockImplementation(() => Promise.resolve(JSON.parse(JSON.stringify(require('./cloudmap-types.fixture.json')))))
    jest.spyOn(console, 'log').mockImplementation(() => {})
    localStorage.clear()
})

afterEach(() => jest.restoreAllMocks())

it('draws the catalog as nested circles and mounts the page\'s apps', async () => {
    const {chart} = pageMarkup()
    await initPublicCloud()

    const svg = chart.querySelector('svg')
    expect(svg).not.toBeNull()
    // the root, its categories and clouds, and a circle per type
    expect(svg.querySelectorAll('circle').length).toBeGreaterThan(3)
    expect(chart.querySelector('#map-controls').children.length).toBeGreaterThan(0)
    // its rows are @gitlab/ui table cells, which the stub does not render
    expect(document.querySelector('#cloud-table').children.length).toBeGreaterThan(0)
})

it('shows a type\'s tooltip after hovering it, and leaves it in place after leaving', async () => {
    jest.useFakeTimers()
    try {
        const {chart} = pageMarkup()
        await initPublicCloud()
        const circle = chart.querySelector('circle.type')
        const {nextTick} = require('vue')

        circle.dispatchEvent(new MouseEvent('mouseover', {clientX: 50, clientY: 60}))
        jest.advanceTimersByTime(600)
        await nextTick()
        expect(document.querySelector('.cloud-tooltip')).not.toBeNull()

        circle.dispatchEvent(new MouseEvent('mouseout'))
        jest.advanceTimersByTime(600)
        await nextTick()
        // leaving moves only the cursor; the tooltip repositions when its item changes
        expect(document.querySelector('.cloud-tooltip').parentElement.style.left).toBe('60px')
    } finally {
        jest.useRealTimers()
    }
})

it('labels categories by their title', async () => {
    const {chart} = pageMarkup()
    await initPublicCloud()
    const fixture = require('./cloudmap-types.fixture.json')
    const titles = Object.values(fixture.Overview.categories).map(c => c.title)
    const labels = Array.from(chart.querySelectorAll('text')).map(t => t.textContent)
    expect(labels.some(label => titles.includes(label))).toBe(true)
})

it('keeps the map controls when it redraws', async () => {
    const {chart} = pageMarkup()
    await initPublicCloud()
    window.dispatchEvent(new Event('resize'))
    expect(chart.querySelector('#map-controls')).not.toBeNull()
})

it('drags the splitter to resize the chart pane', async () => {
    const {layout} = pageMarkup()
    await initPublicCloud()
    const splitter = document.querySelector('#cloud-splitter')
    splitter.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
    expect(document.body.style.userSelect).toBe('none')
    window.dispatchEvent(new MouseEvent('mousemove', {clientY: 400}))
    expect(layout.style.getPropertyValue('--cloud-chart-height')).toMatch(/px$/)
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(document.body.style.userSelect).toBe('')
})

it('shows the welcome banner until it is dismissed', async () => {
    pageMarkup()
    const banner = document.createElement('div')
    banner.id = 'welcome-banner'
    banner.style.display = 'none'
    banner.appendChild(document.createElement('div'))
    const close = document.createElement('button')
    close.className = 'close'
    banner.appendChild(close)
    document.body.appendChild(banner)

    await initPublicCloud()
    expect(banner.style.display).toBe('unset')
    close.click()
    expect(banner.style.display).toBe('none')
    expect(localStorage['uc-cloud-page-dismiss']).toBe('true')
})
