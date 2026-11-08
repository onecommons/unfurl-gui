import {applyRequirementsFilter, applyInputsSchema} from './node-filter'
import {constraintTypeFromRequirement} from './resource-template'
import {resolverName, tryResolveDirective} from './directives'
import {transformEnvironmentVariables, environmentVariableDependencies} from './deployment-template'

describe('node filters', () => {
    // Only nested lists are matched by name; the requirements themselves merge
    // by position, so a filter listed in another order lands on the wrong one.
    it('merges a filter into requirements by position', () => {
        const type = {requirements: [{name: 'db', min: 1}, {name: 'dns'}]}
        applyRequirementsFilter(type, [{name: 'db', max: 2}, {name: 'mail'}])
        expect(type.requirements).toEqual([{name: 'db', min: 1, max: 2}, {name: 'mail'}])
    })

    it('matches nested lists by name, dropping unnamed and unmatched-to-nothing entries', () => {
        const type = {requirements: [{name: 'db', node_filter: {properties: [{name: 'size', min: 1}, {name: 'zone'}]}}]}
        applyRequirementsFilter(type, [{node_filter: {properties: [{name: 'zone', value: 'a'}, {name: 'new'}, {nameless: true}]}}])
        expect(type.requirements[0].node_filter.properties).toEqual([{name: 'zone', value: 'a'}, {name: 'new'}])
    })

    it('merges an inputs schema, removing nulled and computed properties', () => {
        const type = {
            inputsSchema: {properties: {a: {type: 'string'}, b: {type: 'string'}, c: {type: 'string'}}},
            computedPropertiesSchema: {properties: {c: {}}},
        }
        applyInputsSchema(type, {properties: {a: {default: 'x'}, b: null}})
        expect(type.inputsSchema.properties).toEqual({a: {type: 'string', default: 'x'}})
    })
})

it('reads a requirement\'s constraint type, from a name or a requirement', () => {
    expect(constraintTypeFromRequirement('Compute')).toBe('Compute')
    expect(constraintTypeFromRequirement({constraint: {resourceType: 'DNS'}})).toBe('DNS')
    expect(constraintTypeFromRequirement(null)).toBeUndefined()
})

describe('directives', () => {
    it('names the resolver of a known single-key directive', () => {
        expect(resolverName({_generate: 'x'})).toBe('_generate')
    })

    it.each([[{_unknown: 1}], [{_generate: 1, other: 2}], [null], ['text']])('has no resolver for %p', (directive) => {
        expect(resolverName(directive)).toBeNull()
        expect(tryResolveDirective(directive)).toBeNull()
    })
})

describe('deployment environment variables', () => {
    // a property value can be a map or list holding the reference, not the reference itself
    const deployment = () => ({
        DeploymentTemplate: {ResourceTemplate: {app: {properties: [
            {name: 'token', value: {get_env: 'TOKEN'}},
            {name: 'settings', value: {credentials: {password: {get_env: 'PASSWORD'}}}},
            {name: 'hosts', value: [{get_env: 'HOST'}]},
        ]}}},
    })

    it('lists every reference, nested ones included', () => {
        expect(environmentVariableDependencies(deployment()).sort()).toEqual(['HOST', 'PASSWORD', 'TOKEN'])
    })

    it('prefixes every reference it lists', () => {
        const d = deployment()
        transformEnvironmentVariables(d, null, 'p')
        expect(environmentVariableDependencies(d).sort()).toEqual(['p__HOST', 'p__PASSWORD', 'p__TOKEN'])
    })

    it('limits the rename to the variables named, and applies substitutions', () => {
        const d = deployment()
        transformEnvironmentVariables(d, ['PASSWORD'], '', [['PASS', 'SECRET']])
        expect(environmentVariableDependencies(d).sort()).toEqual(['HOST', 'SECRETWORD', 'TOKEN'])
    })

    it('reads a bare resource template too', () => {
        expect(environmentVariableDependencies({properties: [{name: 'x', value: {get_env: 'X'}}]})).toEqual(['X'])
        expect(environmentVariableDependencies({ResourceTemplate: {a: {properties: [{value: {get_env: 'Y'}}]}}})).toEqual(['Y'])
    })
})
