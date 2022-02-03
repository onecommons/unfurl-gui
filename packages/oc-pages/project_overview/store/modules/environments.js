import { __ } from "~/locale";
import gql from 'graphql-tag'
import graphqlClient from '../../graphql';
import _ from 'lodash'

const state = {
    environmentName: __("Oc Default"),
    environments: []
};

const mutations = {

    SET_ENVIRONMENT_NAME(_state, { envName }) {
        // eslint-disable-next-line no-param-reassign
        _state.environmentName = envName;
    },

    setEnvironments(state, environments) {
        state.environments = environments
    },

    setProjectEnvironments(state, environments) {
        state.projectEnvironments = environments
    }

};

const actions = {

    setEnvironmentName({ commit }, envName) {
        commit("SET_ENVIRONMENT_NAME", { envName });
    },


    async fetchProjectEnvironments({commit}, {fullPath}) {
        const query = gql`
        query getProjectEnvironments($fullPath: ID!) {
          project(fullPath: $fullPath) {
            environments {
              nodes {
                name
                state
              }
            }
          }
        }`
        let environments
        try {
            const {data, errors} = await graphqlClient.clients.defaultClient.query({
                query,
                errorPolicy: 'all',
                variables: {fullPath}
            })

            environments = data?.project?.environments?.nodes
        }
        catch(e){
            console.error('could not fetch project environments')
            console.error(e)
            environments = []

        }

        commit('setProjectEnvironments', environments)

    },
    async fetchEnvironments({ commit, dispatch, rootGetters }, {fullPath, projectPath}) {
        await dispatch('fetchProjectEnvironments', {fullPath: fullPath || projectPath})
        const query = gql`
        query getEnvironments($namespace: String!) {
            environments(namespace: $namespace) {
                namespace
                name
                clientPayload
                environments(dehydrated: false) @client {
                    name
                    connections 
                    cloud
                    primary_provider
                    deployments
                }
            }
        }
        `

        const namespace = rootGetters.getUsername
        let environments

        try {
            const {data, errors} = await graphqlClient.clients.defaultClient.query({
                query,
                errorPolicy: 'all',
                variables: {namespace}
            })

            environments = data?.environments?.environments
            for (const environment of environments) {
                for(const key in environment.connections) { // at the time of writing this, the local resolver is doing something totally bizarre
                    if(isNaN(parseInt(key))) {
                        delete environment.connections[key]
                    }
                }
                environment.connections = Object.values(environment.connections)
            }

        }
        catch(e){
            console.error('could not fetch environments')
            console.error(e)
            environments = []

        }
        commit('setEnvironments', environments)
        return environments

    }
};
function envFilter(name){
    return env => env.name == name
} 

const getters = {
    getEnvironmentName: _state => _state.environmentName,
    getEnvironments: state => state.environments.concat(state.projectEnvironments),
    getValidConnections: state => function(environmentName, requirement) {
        let constraintType
        if(typeof requirement != 'string') { constraintType = requirement?.constraint?.resourceType 
        } else { constraintType  = requirement }
        const filter = envFilter(environmentName)
        const environment = state.environments.find(filter) || state.projectEnvironments.find(filter)
        //if(!environment) {throw new Error(`Environment ${environmentName} not found`)}
        if(!environment) return []
        const result = environment.connections.filter(conn => conn.type == constraintType)
        return result
    },
    lookupConnection: state => function(environmentName, connectedResource) {
        const filter = envFilter(environmentName)
        const environment = state.environments.find(filter) || state.projectEnvironments.find(filter)
        //if(!environment) {throw new Error(`Environment ${environmentName} not found`)}
        if(!environment) return null
        const result = _.cloneDeep(environment.connections.find(conn => conn.name == connectedResource))
        return result
    }
};

export default {
    state,
    mutations,
    actions,
    getters
};
