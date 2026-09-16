import {mapProviderProps} from './provider-props'

// What GET /:project/-/environments/:name/provider answers with --
// Projects::EnvironmentProvidersController#represent.
const gcpRecord = {
    provider: 'gcp',
    region: null,
    zone: 'us-central1-c',
    gcp_project_id: 'env-a-project',
    role_arn: null,
    access_token_usable: true,
}

const awsRecord = {
    provider: 'aws',
    region: 'us-east-2',
    zone: null,
    gcp_project_id: null,
    role_arn: 'arn:aws:iam::123456789012:role/unfurl',
    access_token_usable: true,
}

const byName = (props, name) => props.find(prop => prop.name == name)

describe('mapProviderProps', () => {
    it('reads the provider record the environment page fetched', () => {
        const props = mapProviderProps(gcpRecord)

        expect(byName(props, 'Project ID').value).toBe('env-a-project')
        expect(byName(props, 'Zone').value).toBe('us-central1-c')
    })

    it('reads aws from the same record', () => {
        const props = mapProviderProps(awsRecord)

        expect(byName(props, 'Default region').value).toBe('us-east-2')
        expect(byName(props, 'Role ARN').value).toBe('arn:aws:iam::123456789012:role/unfurl')
    })

    // Role ARN has no CI-variable spelling: the record is its only source, so
    // dropping the record would silently drop the row.
    it('has no source for Role ARN other than the record', () => {
        const props = mapProviderProps({AWS_DEFAULT_REGION: 'us-east-2', AWS_ACCESS_KEY_ID: 'AKIA'})

        expect(byName(props, 'Role ARN')).toBeUndefined()
    })

    // ...and the access key has no record spelling.
    it('has no source for the access key other than the variables', () => {
        expect(byName(mapProviderProps(awsRecord), 'Access key')).toBeUndefined()
        expect(byName(mapProviderProps({AWS_ACCESS_KEY_ID: 'AKIA'}), 'Access key').value).toBe('AKIA')
    })

    it('ignores record fields that are not props', () => {
        const names = mapProviderProps(gcpRecord).map(prop => prop.name)

        expect(names).not.toContain('provider')
        expect(names).not.toContain('access_token_usable')
    })

    describe('when both sources carry a prop', () => {
        // The variables are spread after the record by the caller, so they are
        // what the user last saved through the panel.
        it('prefers the variable', () => {
            const props = mapProviderProps({...gcpRecord, CLOUDSDK_CORE_PROJECT: 'edited-project'})

            expect(byName(props, 'Project ID').value).toBe('edited-project')
        })

        it('keeps one row per prop rather than two', () => {
            const props = mapProviderProps({...gcpRecord, CLOUDSDK_CORE_PROJECT: 'edited-project'})

            expect(props.filter(prop => prop.name == 'Project ID')).toHaveLength(1)
        })

        it('falls back to the record when the variable is not set', () => {
            const props = mapProviderProps({...gcpRecord, CLOUDSDK_CORE_PROJECT: ''})

            expect(byName(props, 'Project ID').value).toBe('env-a-project')
        })
    })

    /*
     * The bug this mapping was moved off: PROP_MAP used to be keyed by
     * #js-oc-ci-variables' dataset names, and that dataset is rendered from
     * whichever environment the *page load* was for. The dashboard routes
     * between environments without reloading, so those values outlived the
     * environment they described.
     */
    it('cannot be fed by the server-rendered dataset', () => {
        const stale = {
            primaryProviderGcpProjectId: 'env-a-project',
            primaryProviderGcpZone: 'us-central1-c',
            primaryProviderAwsDefaultRegion: 'us-east-2',
            primaryProviderAwsRoleArn: 'arn:aws:iam::123456789012:role/unfurl',
        }

        expect(mapProviderProps(stale)).toEqual([])
    })

    it('shows nothing rather than another environment\'s values', () => {
        // routed to an environment whose provider has no zone recorded
        const props = mapProviderProps({...gcpRecord, zone: null, CLOUDSDK_COMPUTE_ZONE: undefined})

        expect(byName(props, 'Zone')).toBeUndefined()
    })

    /*
     * #represent always emits all four fields, so the record for one provider
     * carries nulls for the other's. Those must not become rows: the dataset
     * this replaced never could, because haml drops nil-valued data attributes.
     */
    it('leaves out the fields a gcp record nulls', () => {
        const names = mapProviderProps(gcpRecord).map(prop => prop.name)

        expect(names).not.toContain('Role ARN')
        expect(names).not.toContain('Default region')
    })

    it('leaves out the fields an aws record nulls', () => {
        const names = mapProviderProps(awsRecord).map(prop => prop.name)

        expect(names).not.toContain('Project ID')
        expect(names).not.toContain('Zone')
    })

    it('renders a row only for what the record actually has', () => {
        expect(mapProviderProps(gcpRecord).map(prop => prop.name).sort())
            .toEqual(['Project ID', 'Zone'])
    })

    it('survives a null record', () => {
        expect(mapProviderProps({})).toEqual([])
    })
})
