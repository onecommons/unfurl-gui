import {baseRouteNaive} from './base-route';


test('basic dashboard route', () => {
    expect(baseRouteNaive('/home/jdenne')).toEqual('/home/jdenne');
});

test('basic dashboard route arriving at environment', () => {
    expect(baseRouteNaive('/home/jdenne/-/environment')).toEqual('/home/jdenne');
});

test('basic dashboard route arriving at deployments', () => {
    expect(baseRouteNaive('/home/jdenne/-/deployments')).toEqual('/home/jdenne');
});
