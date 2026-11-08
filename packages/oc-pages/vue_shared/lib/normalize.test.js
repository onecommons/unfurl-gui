import {normpath, localNormalize} from './normalize'

beforeEach(() => { window.gon = {home_project: 'org/dash'} })

describe('normpath', () => {
    it('drops empty segments', () => {
        expect(normpath('/org//dash/')).toBe('org/dash')
    })

    it('reads ":" as the home project', () => {
        expect(normpath(':')).toBe('org/dash')
    })

    it.each([[''], [undefined], [null], [3]])('passes %p through, or drops a non-string', (value) => {
        expect(normpath(value)).toBe(typeof value == 'string' ? value : undefined)
    })
})

describe('localNormalize', () => {
    it('ignores nothing, primitives and what it has already done', () => {
        expect(() => localNormalize(null)).not.toThrow()
        expect(() => localNormalize(0.1, 'ResourceType')).not.toThrow()
        const done = {_normalized: true, name: 'x'}
        localNormalize(done, 'ResourceType')
        expect(done).toEqual({_normalized: true, name: 'x'})
    })

    it('needs a typename', () => {
        expect(() => localNormalize({name: 'x'})).toThrow("Couldn't normalize x: no typename")
    })

    it('normalizes path properties of any type', () => {
        const object = {__typename: 'Other', projectPath: '/org//dash/', blueprintPath: ':'}
        localNormalize(object)
        expect(object).toMatchObject({projectPath: 'org/dash', blueprintPath: 'org/dash'})
        expect(object._normalized).toBeUndefined()
    })

    describe('ResourceType', () => {
        const type = (extra = {}) => ({name: 'Compute@unfurl.cloud/onecommons/std', ...extra})

        it('fills in defaults', () => {
            const rt = type()
            localNormalize(rt, 'ResourceType')
            expect(rt).toMatchObject({
                __typename: 'ResourceType', title: rt.name, _localName: 'Compute',
                requirements: [], metadata: {}, _maxUtilization: 1, _normalized: true,
            })
        })

        it('gives an alias no implementations and wraps a single deprecation', () => {
            const rt = type({metadata: {alias: true, deprecates: 'Old'}, implementations: ['create']})
            localNormalize(rt, 'ResourceType')
            expect(rt.implementations).toEqual([])
            expect(rt.metadata.deprecates).toEqual(['Old'])
        })

        it('rewrites the old substitution directive, and lets a substitute use none of its requirements', () => {
            const rt = type({directives: ['substitution'], requirements: [{name: 'db'}]})
            localNormalize(rt, 'ResourceType')
            expect(rt.directives).toEqual(['substitute'])
            expect(rt.requirements).toEqual([{name: 'db', title: 'db', _utilization: 0}])
        })

        it('drops hidden requirements unless matched', () => {
            const rt = type({requirements: [{name: 'a', visibility: 'hidden'}, {name: 'b', visibility: 'hidden', match: 'x'}, {name: 'c'}]})
            localNormalize(rt, 'ResourceType')
            expect(rt.requirements.map(r => r.name)).toEqual(['b', 'c'])
        })

        it('normalizes schema properties, nested ones included', () => {
            const rt = type({inputsSchema: {properties: {
                secret: {hidden: true},
                key_file: {default: {eval: {abspath: 'key'}}, sensitive: true},
                tags: {type: 'object', additionalProperties: true, title: 'extra tags', metadata: {additionalPropertiesAddLabel: 'Add tag'}},
                nested: {type: 'object', properties: {inner: {hidden: true}}},
            }}})

            localNormalize(rt, 'ResourceType')

            const {secret, key_file, tags, nested} = rt.inputsSchema.properties
            expect(secret.visibility).toBe('hidden')
            expect(key_file).toMatchObject({input_type: 'file', sensitive: false})
            expect(tags).toMatchObject({tab_title: 'Extra Tags', additionalPropertiesAddLabel: 'Add tag'})
            expect(nested.properties.inner.visibility).toBe('hidden')
        })
    })

    describe('ResourceTemplate', () => {
        const template = (extra = {}) => ({name: 'db', type: 'Postgres@unfurl.cloud/onecommons/std', ...extra})

        it('fills in defaults and takes the type\'s source', () => {
            const rt = template()
            localNormalize(rt, 'ResourceTemplate', {ResourceType: {[rt.type]: {_sourceinfo: {file: 'db.yaml'}}}})
            expect(rt).toMatchObject({
                __typename: 'ResourceTemplate', title: 'db', _localTypeName: 'Postgres', visibility: 'inherit',
                dependencies: [], _sourceinfo: {file: 'db.yaml'}, _maxUtilization: 1,
            })
        })

        it('reads the type name off a resolved type', () => {
            const rt = template({type: {name: 'Postgres@x'}})
            localNormalize(rt, 'ResourceTemplate')
            expect(rt._localTypeName).toBe('Postgres')
        })

        it('settles each dependency\'s visibility and drops hidden unmatched ones', () => {
            const rt = template({directives: ['substitute'], dependencies: [
                {name: 'host', constraint: {name: 'host', visibility: 'hidden'}, match: 'vm'},
                {name: 'dns', constraint: {name: 'dns', visibility: 'hidden'}},
                {name: 'mail', visibility: 'visible', constraint: {name: 'mail'}},
            ]})

            localNormalize(rt, 'ResourceTemplate')

            expect(rt.dependencies.map(d => d.name)).toEqual(['host', 'mail'])
            expect(rt.dependencies[0]).toMatchObject({visibility: 'hidden', title: 'host', _utilization: 0})
            expect(rt.dependencies[0].constraint).toMatchObject({visibility: 'hidden', title: 'host', _utilization: 0})
            expect(rt.dependencies[1].constraint.visibility).toBe('visible')
        })

        // earlier clients saved 'visibile'; it means visible
        it('reads the saved visibility typo as visible', () => {
            const rt = template({dependencies: [{name: 'db', constraint: {name: 'db', visibility: 'visibile'}, match: 'x'}]})
            localNormalize(rt, 'ResourceTemplate')
            expect(rt.dependencies[0].visibility).toBe('visible')
            expect(rt.dependencies[0].constraint.visibility).toBe('visible')
        })

        it('logs a type it cannot find the source of', () => {
            const error = jest.spyOn(console, 'error').mockImplementation(() => {})
            const rt = template()
            localNormalize(rt, 'ResourceTemplate', {})
            expect(rt._sourceinfo).toBeUndefined()
            expect(error).toHaveBeenCalled()
            error.mockRestore()
        })
    })

    describe('DeploymentTemplate', () => {
        it('normalizes its local templates and inherits the blueprint\'s paths', () => {
            const root = {ApplicationBlueprint: {bp: {projectPath: 'org/bp', blueprintPath: 'org/bp/x'}}, ResourceType: {}}
            const dt = {source: '__generated', blueprintPath: 'own', ResourceTemplate: {vm: {name: 'vm', type: 'VM'}}}

            jest.spyOn(console, 'error').mockImplementation(() => {})
            localNormalize(dt, 'DeploymentTemplate', root)
            console.error.mockRestore()

            expect(dt._sourceTemplate).toBeUndefined()
            expect(dt.projectPath).toBe('org/bp')
            expect(dt.blueprintPath).toBe('own')
            expect(dt.ResourceTemplate.vm).toMatchObject({_local: true, __typename: 'ResourceTemplate'})
        })

        it('remembers the template it came from', () => {
            const dt = {source: 'aws'}
            localNormalize(dt, 'DeploymentTemplate', {ApplicationBlueprint: {}})
            expect(dt._sourceTemplate).toBe('aws')
        })
    })

    describe('Deployment', () => {
        const root = (computedProperties) => ({
            _environment: 'prod',
            Resource: {app: {computedProperties}},
        })

        it('reads the health check and readiness from the primary resource', () => {
            const deployment = {primary: 'app'}
            localNormalize(deployment, 'Deployment', root([
                {name: 'health_check_url', value: 'app.example.com/health'},
                {name: 'readiness_estimate', value: 300},
            ]))
            expect(deployment).toMatchObject({
                _environment: 'prod', healthCheckUrl: 'https://app.example.com/health', readinessEstimate: 300,
            })
        })

        it('keeps a health check url that has a scheme', () => {
            const deployment = {primary: 'app'}
            localNormalize(deployment, 'Deployment', root([{name: 'health_check_url', value: 'http://app/health'}]))
            expect(deployment.healthCheckUrl).toBe('http://app/health')
        })

        // most deployments have no health check
        it('reads readiness without a health check url', () => {
            const deployment = {primary: 'app'}
            localNormalize(deployment, 'Deployment', root([{name: 'readiness_estimate', value: 300}]))
            expect(deployment.healthCheckUrl).toBeUndefined()
            expect(deployment.readinessEstimate).toBe(300)
        })

        it('reads the deploy time as UTC', () => {
            const deployment = {deployTime: '2026-01-02T03:04:05'}
            localNormalize(deployment, 'Deployment', {})
            expect(deployment.deployTime.toISOString()).toBe('2026-01-02T03:04:05.000Z')
        })

        it('keeps a deploy time that already has a zone', () => {
            const deployment = {deployTime: '2026-01-02T03:04:05+01:00'}
            localNormalize(deployment, 'Deployment', {})
            expect(deployment.deployTime.toISOString()).toBe('2026-01-02T02:04:05.000Z')
        })
    })

    it('normalizes an application blueprint\'s paths', () => {
        const blueprint = {projectPath: '/org/bp/', blueprintPath: ':'}
        localNormalize(blueprint, 'ApplicationBlueprint')
        expect(blueprint).toMatchObject({projectPath: 'org/bp', blueprintPath: 'org/dash', _normalized: true})
    })
})
