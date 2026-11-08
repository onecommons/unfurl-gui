import axios from '~/lib/utils/axios_utils'
import csrf from '~/lib/utils/csrf'
import gql from 'graphql-tag'
import graphqlClient from 'oc/graphql_shim'

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

export interface UserProject {
    id: number
    fullPath: string
    name: string
}

interface ProjectMembership {
    accessLevel: {integerValue: number}
    project: {id: string, fullPath: string, name: string}
}

export async function fetchUserProjects(_options?: {minimumAccessLevel?: number}): Promise<UserProject[]> {
    const options = Object.assign({
        minimumAccessLevel: 30
    }, _options)

    const response = await graphqlClient.query({
        query: getUserProjectsQuery
    })

    const nodes: ProjectMembership[] = response.data?.currentUser?.projectMemberships?.nodes || []

    let dashboards: string[]
    try {
        dashboards = (await axios.get('/api/v4/dashboards?min_access_level=40')).data
            .map((dashboardProject: {name: string}) => dashboardProject.name)
    } catch(e) {
        dashboards = []
    }

    return nodes
        .filter(node => node.accessLevel.integerValue >= options.minimumAccessLevel && !dashboards.includes(node.project.name))
        .map(node => {
            const project = node.project
            return Object.assign(project, {id: parseInt(project.id.split('/').pop()!)}) as unknown as UserProject
        })
}

const getUserPublicEmailQuery = gql`
query getUserPublicEmail {
    currentUser {
      publicEmail
    }
}
`

export async function fetchUserPublicEmail(): Promise<string | null> {
    const response = await graphqlClient.query({
        query: getUserPublicEmailQuery
    })

    return response.data?.currentUser?.publicEmail || null // using || because it defaults to an empty string
}


export async function generateAccessToken(tokenName: string, options?: {scopes?: string[], expiresAt?: string}): Promise<string | undefined> {
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
    return dom.querySelector<HTMLInputElement>('#created-personal-access-token')?.value
}

export async function fetchUser() {
    // #!if !standalone
    return (await axios.get('/api/v4/user'))?.data
    // #!endif

    return {}
}

let userAccessToken: Promise<string | null> | undefined
export async function fetchUserAccessToken(): Promise<string | null> {
    if(window.gon.unfurl_gui) return ''
    if(!userAccessToken) {
        userAccessToken = (async () => {
            try { return (await axios.get('/api/v4/unfurl_access_token'))?.data?.token }
            catch(e) { return null }
        })()
    }
    return await userAccessToken
}

