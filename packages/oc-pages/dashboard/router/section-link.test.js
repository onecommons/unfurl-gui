import {sectionLinkProps, sectionLinkHref} from './section-link';

const to = {name: 'dashboardDeploymentsIndex'};
const router = {resolve: () => ({href: '/acme/dash/-/deployments'})};

beforeEach(() => { window.gon = {}; });

test('standalone routes in place', () => {
    window.gon.unfurl_gui = true;
    expect(sectionLinkProps(router, to)).toEqual({to});
    expect(sectionLinkHref(router, to)).toEqual(to);
});

test('the fork navigates for real, so the server recomputes the sidebar', () => {
    window.gon.unfurl_gui = false;
    expect(sectionLinkProps(router, to)).toEqual({href: '/acme/dash/-/deployments'});
    expect(sectionLinkHref(router, to)).toEqual('/acme/dash/-/deployments');
});

test('an absent flag is the fork, not standalone', () => {
    expect(sectionLinkProps(router, to)).toEqual({href: '/acme/dash/-/deployments'});
});
