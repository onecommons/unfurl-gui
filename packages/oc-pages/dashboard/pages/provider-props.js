// Keyed by both the provider record's field names (Projects::EnvironmentProviders
// #represent) and the environment variables the setup panels write, because
// neither source carries every prop: role_arn exists only on the record, and the
// access key only as a variable.
//
// These were once keyed by the #js-oc-ci-variables dataset instead
// (primaryProviderGcpProjectId and friends). That dataset is rendered from one
// environment and the dashboard routes between them without reloading, so the
// values it seeded went stale -- one environment's Project ID, Zone or Region
// showed on another's Cloud Provider card. Both sources here are fetched per
// environment.
export const PROP_MAP = {
    gcp_project_id(value) { return {name: 'Project ID', value} },
    zone(value) { return {name: 'Zone', value} },
    role_arn(value) { return {name: 'Role ARN', value} },
    region(value) { return {name: 'Default region', value} },
    CLOUDSDK_CORE_PROJECT(value) { return {name: 'Project ID', value} },
    CLOUDSDK_COMPUTE_ZONE(value) { return {name: 'Zone', value} },
    AWS_DEFAULT_REGION(value) { return {name: 'Default region', value} },
    AWS_ACCESS_KEY_ID(value) { return {name: 'Access key', value} },
}

// Two keys can carry the same prop -- the provider record's field and the
// environment variable the panel writes. Keep one row per name, and let the
// later key win when it has a value: the caller spreads the variables after the
// record, so that is the one the user last saved.
export function mapProviderProps(source) {
    const result = []
    const indexByName = {}

    for(const key in source) {
        const mapping = PROP_MAP[key]
        if(typeof mapping != 'function') continue

        // The provider record always carries all four fields, so a gcp record
        // has `role_arn: null` and an aws one `gcp_project_id: null`. Mapping
        // those would put an empty Role ARN row on every gcp card and an empty
        // Project ID row on every aws one. (The dataset this replaced never hit
        // it: haml omits nil-valued data attributes entirely.)
        if(source[key] == null) continue

        const newProp = mapping(source[key])
        if(!newProp) continue

        const seen = indexByName[newProp.name]
        if(seen === undefined) {
            indexByName[newProp.name] = result.length
            result.push(newProp)
        } else if(newProp.value) {
            result[seen] = newProp
        }
    }

    return result
}
