import getFormattedData from './formatted-data'
import {lookupCloudProviderAlias} from 'oc_vue_shared/util'
import fixture from './cloudmap-types.fixture.json'

// getFormattedData mutates the payload it is given (resolving components, assigning
// genericIcon and details_url), so hand each call its own copy
jest.mock('./raw-data', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve(JSON.parse(JSON.stringify(require('./cloudmap-types.fixture.json')))))
}))

function byTitle(entries, title) {
    return entries.find(entry => entry.type.title == title)
}

let entries

beforeAll(async () => {
    // formatted-data logs every url it templates; jest restores the spy for us
    jest.spyOn(console, 'log').mockImplementation(() => {})
    entries = await getFormattedData()
})

test('flattens the catalog into category/cloud/type leaves', () => {
    expect(entries).toHaveLength(8)

    for(const entry of entries) {
        expect(entry).toMatchObject({
            category: expect.any(String),
            cloud: expect.any(String),
            type: expect.objectContaining({name: expect.any(String), title: expect.any(String)})
        })
    }
})

test('leaves carry a cloud the provider icons are keyed by', () => {
    // the chart looks these up verbatim -- short names like 'AWS' would silently
    // render no provider icon
    for(const entry of entries) {
        expect(lookupCloudProviderAlias(entry.cloud)).toBeDefined()
    }
})

test('drops abstract types', () => {
    // no implementations at all
    expect(byTitle(entries, 'Generic Compute')).toBeUndefined()
    // an app that cannot be connected to
    expect(byTitle(entries, 'Abstract App')).toBeUndefined()
})

test('resolves component references to types, ignoring unknown ones', () => {
    expect(byTitle(entries, 'Nextcloud').type.metadata.components.map(c => c.title))
        .toEqual(['Kubernetes Pod', 'RDS Postgres'])

    expect(byTitle(entries, 'WordPress').type.metadata.components.map(c => c.title))
        .toEqual(['EC2 Instance'])
})

test('inherits an icon from an abstract sibling of the same parent', () => {
    expect(byTitle(entries, 'EC2 Instance').type.genericIcon)
        .toEqual(fixture.ResourceType['GenericCompute@unfurl.cloud/onecommons/std:generic/compute'].icon)

    // the abstract compute type says nothing about databases
    expect(byTitle(entries, 'RDS Postgres').type.genericIcon).toBeUndefined()
})

test('builds details_url from the documentation url template', () => {
    expect(byTitle(entries, 'EC2 Instance').type.details_url)
        .toEqual('https://unfurl.cloud/onecommons/std/-/blob/main/aws.compute.yaml')
})

test('every leaf has the _sourceinfo url the chart dereferences', () => {
    // appIconHref in index.js reads _sourceinfo.url without guarding
    for(const entry of entries) {
        expect(entry.type._sourceinfo.url).toEqual(expect.any(String))
    }
})
