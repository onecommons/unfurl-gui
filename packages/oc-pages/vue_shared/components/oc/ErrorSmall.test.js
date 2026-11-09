import {mount} from '@vue/test-utils'
import {defineComponent, h, ref, nextTick} from 'vue'
import ErrorSmall from './ErrorSmall.vue'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const global = {mocks: {__: s => s}}

it('shows and hides with its condition, after a short delay', async () => {
    const wrapper = mount(ErrorSmall, {props: {condition: false, message: 'bad'}, global})
    expect(wrapper.find('small').exists()).toBe(false)

    await wrapper.setProps({condition: true})
    expect(wrapper.find('small').exists()).toBe(false)
    jest.advanceTimersByTime(500)
    await nextTick()
    expect(wrapper.find('small').text()).toBe('bad')
})

// One change can flip two messages at once -- clearing a CNAME's subdomain
// shows its own error and the deploy button's. Each must follow its own
// condition.
it('updates every instance whose condition changed together', async () => {
    const first = ref(true)
    const second = ref(false)
    const wrapper = mount(defineComponent({
        render: () => h('div', [
            h(ErrorSmall, {condition: first.value, message: 'first'}),
            h(ErrorSmall, {condition: second.value, message: 'second'}),
        ]),
    }), {global})
    expect(wrapper.findAll('small').map(s => s.text())).toEqual(['first'])

    first.value = false
    second.value = true
    await nextTick()
    jest.advanceTimersByTime(500)
    await nextTick()
    expect(wrapper.findAll('small').map(s => s.text())).toEqual(['second'])
})
