import gql from 'graphql-tag'
import graphqlClient from 'oc/graphql-shim'
import axios from '~/lib/utils/axios_utils'

function generateConfig(options) {
    if(options?.accessToken) {
        return {headers: {
            'PRIVATE-TOKEN': options.accessToken
        }}
    }
}

export async function fetchProjects(options={}) {
    // TODO this probably doesn't need access level 40
    const {minAccessLevel} = options

    let _minAccessLevel = minAccessLevel ?? 40

    let result = (await axios.get(`/api/v4/projects?min_access_level=${_minAccessLevel}`, generateConfig(options)))?.data
    const dashboards = (await axios.get('/api/v4/dashboards?min_access_level=10', generateConfig(options))).data
        .map(dashboardProject => dashboardProject.path_with_namespace)

    result = result.filter(project => !dashboards.includes(project.path_with_namespace))
    return result
}

export async function fetchRegistryRepositories(projectId, options) {
    return (await axios.get(`/api/v4/projects/${projectId}/registry/repositories?per_page=99999`, generateConfig(options)))?.data
}

export async function fetchRepositoryBranches(projectId, options) {
    return (await axios.get(`/api/v4/projects/${projectId}/repository/branches?per_page=99999`, generateConfig(options)))?.data
}

export async function fetchProjectInfo(projectId, options) {
    return (await axios.get(`/api/v4/projects/${projectId}`, generateConfig(options)))?.data
}

export async function fetchProjectPipelines(projectId, options) {
    return (await axios.get(`/api/v4/projects/${projectId}/pipelines`, generateConfig(options)))?.data
}

export async function fetchProjectAccessTokens(projectId) {
    return (await axios.get(`/api/v4/projects/${projectId}/access_tokens`))?.data
}

export async function fetchCommit(projectId, commitHash) {
    return (await axios.get(`/api/v4/projects/${projectId}/repository/commits/${commitHash}`))?.data
}

export async function generateProjectAccessToken(projectId, options) {
    console.log(`Generating a project token for ${projectId}`)
    const _options = Object.assign({
        name: 'DashboardProjectAccessToken',
        scopes: ['read_repository', 'read_registry']
    }, options)
    _options.id = projectId
    return (await axios.post(`/api/v4/projects/${projectId}/access_tokens`, _options))?.data?.token
}

const query = gql`
query getContainerRepositories($fullPath: ID!) {
    project(fullPath: $fullPath) {
        __typename
        id
        containerRepositoriesCount
        containerRepositories {
          __typename
          nodes {
            id
            name
            path
            status
            location
            __typename
          }
        }
    }
}
`

export async function fetchContainerRepositories(fullPath) {
    const response = await graphqlClient.clients.defaultClient.query({
        query,
        variables: {fullPath}
    })

    const nodes = response.data?.project?.containerRepositories?.nodes || []
    return nodes
}
