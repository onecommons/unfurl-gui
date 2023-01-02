import axios from '~/lib/utils/axios_utils'
import csrf from '~/lib/utils/csrf'
import gql from 'graphql-tag'
import graphqlClient from 'oc/graphql-shim'
import {postFormDataWithEntries} from './forms.js'

const getUserProjectsQuery = gql`
query getUserProjects {
    currentUser {
        projectMemberships {
            nodes {
                accessLevel {
                    integerValue
                }
                project {
                    id
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

    let dashboards
    try {
        dashboards = (await axios.get('/api/v4/dashboards?min_access_level=40')).data
            .map(dashboardProject => dashboardProject.name)
    } catch(e) {
        dashboards = []
    }

    return nodes
        .filter(node => node.accessLevel.integerValue >= options.minimumAccessLevel && !dashboards.includes(node.project.name))
        .map(node => {
            const project = node.project
            project.id = parseInt(project.id.split('/').pop())
            return project
        })
}

const getUserPublicEmailQuery = gql`
query getUserPublicEmail {
    currentUser {
      publicEmail
    }
}
`

export async function fetchUserPublicEmail() {
    const response = await graphqlClient.clients.defaultClient.query({
        query: getUserPublicEmailQuery
    })

    return response.data?.currentUser?.publicEmail || null // using || because it defaults to an empty string
}


export async function generateAccessToken(tokenName, options) {
    const {scopes, expiresAt} = Object.assign({
        scopes: ['read_repository', 'read_registry'],
        expiresAt: ''
    }, options)

    const baseURL = '/-/profile/personal_access_tokens'
    const data = [
        ['authenticity_token', csrf.token],
        ['personal_access_token[name]', tokenName],
        ['personal_access_token[expires_at]', expiresAt],
    ]

    for(const scope of scopes) {
        data.push(['personal_access_token[scopes][]', scope])
    }

    const query = data.map(entry => `${encodeURIComponent(entry[0])}=${encodeURIComponent(entry[1])}`).join('&')

    const response = await axios.post(
        baseURL,
        query,
        {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    )

    const domParser = new DOMParser()
    const dom = domParser.parseFromString(response.data, 'text/html')
    return dom.querySelector('#created-personal-access-token')?.value
}

export async function fetchUser() {
    return (await axios.get('/api/v4/user'))?.data
}

let userAccessToken
export async function fetchUserAccessToken() {
    if(!userAccessToken) {
        try {
            const {token} = (await axios.get('/api/v4/unfurl_access_token'))?.data
            userAccessToken = token
        } catch(e) {
            console.error(e)
        }
    }
    return userAccessToken
}

