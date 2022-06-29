import gql from 'graphql-tag'
import graphqlClient from 'oc/graphql-shim'

const getUserProjectsQuery = gql`
query getUserProjects {
    currentUser {
        projectMemberships {
            nodes {
                accessLevel {
                    integerValue
                }
                project {
                    fullPath
                    name
                }
            }
        }
    }
}
`

export async function fetchUserProjects(_options) {
    const options = Object.assign({
        minimumAccessLevel: 30
    }, _options)

    const response = await graphqlClient.clients.defaultClient.query({
        query: getUserProjectsQuery
    })

    const nodes = response.data?.currentUser?.projectMemberships?.nodes || []

    console.log({nodes, response})
    return nodes
        .filter(node => node.accessLevel.integerValue >= options.minimumAccessLevel && node.project.name != 'dashboard')
        .map(node => node.project)
}
