import {baseRouteNaive} from './base-route';


test('basic dashboard route', () => {
    expect(baseRouteNaive('/jdenne/dashboard')).toEqual('/jdenne/dashboard');
});

test('basic dashboard route arriving at environment', () => {
    expect(baseRouteNaive('/jdenne/dashboard/-/environments')).toEqual('/jdenne/dashboard');
});

test('secondary dashboard route arriving at deployments', () => {
    expect(baseRouteNaive('/jdenne/dashboard2/-/deployments')).toEqual('/jdenne/dashboard2');
});


test('dashboard with longer namespace', () => {
    expect(baseRouteNaive('/onecommons/foo/dashboard/-/environment')).toEqual('/onecommons/foo/dashboard');
});
