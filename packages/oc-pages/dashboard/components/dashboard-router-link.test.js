import {mount} from '@vue/test-utils'
import DashboardRouterLink from './dashboard-router-link.vue'

const RouterLink = {name: 'RouterLink', props: ['to'], template: '<a class="router-link"><slot/></a>'}
const mountLink = props => mount(DashboardRouterLink, {props, slots: {default: 'text'}, global: {stubs: {RouterLink}}})

it('routes a dashboard path within the dashboard', () => {
    expect(mountLink({href: '/dashboard/deployments'}).findComponent(RouterLink).props('to')).toBe('/deployments')
})

it('routes a route location', () => {
    const to = {name: 'deployment'}
    expect(mountLink({href: {to}}).findComponent(RouterLink).props('to')).toEqual(to)
})

// Its callers may not have the destination yet on the first render.
it('renders its content unlinked until it has a destination', () => {
    const wrapper = mountLink({})
    expect(wrapper.findComponent(RouterLink).exists()).toBe(false)
    expect(wrapper.text()).toBe('text')
})
