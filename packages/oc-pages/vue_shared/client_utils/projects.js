import gql from 'graphql-tag'
import graphqlClient from 'oc/graphql-shim'
import axios from '~/lib/utils/axios_utils'

export async function fetchRepositoryBranches(projectId) {
    return (await axios.get(`/api/v4/projects/${projectId}/repository/branches?per_page=99999`))?.data
}

export async function fetchProjectInfo(projectId) {
    return (await axios.get(`/api/v4/projects/${projectId}`))?.data
}

export async function fetchProjectAccessTokens(projectId) {
    return (await axios.get(`/api/v4/projects/${projectId}/access_tokens`))?.data
}

export async function generateProjectAccessToken(projectId, options) {
    if(isNaN(parseInt(projectId))) {
        throw new Error('Project id must be a number')
    }
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
