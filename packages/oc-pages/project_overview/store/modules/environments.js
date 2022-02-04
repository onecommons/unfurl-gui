import { __ } from "~/locale";
import gql from 'graphql-tag'
import graphqlClient from '../../graphql';
import _ from 'lodash'
import { USER_HOME_PROJECT, lookupCloudProviderAlias } from '../../../vue_shared/util.mjs'

const state = {
    environmentName: __("Oc Default"),
    environments: [],
    projectEnvironments: []
};

function connectionsToArray(environment) {
    if(environment.connections) {
        for(const key in environment.connections) { 
            if(isNaN(parseInt(key))) { //// not sure how much of this is still needed
                delete environment.connections[key]
            }
        }
        environment.connections = Object.values(environment.connections)
    }
    return environment
}

const mutations = {

    SET_ENVIRONMENT_NAME(_state, { envName }) {
        // eslint-disable-next-line no-param-reassign
        _state.environmentName = envName;
    },

    setEnvironments(state, environments) {
        state.environments = environments
    },

    resetEnvironments(state) {
        // map is kinda pointless here
        state.environments = state.environments.map(connectionsToArray)
        state.projectEnvironments = state.projectEnvironments.map(connectionsToArray)
    },

    setProjectEnvironments(state, environments) {
        state.projectEnvironments = environments
    }

};

const actions = {

    setEnvironmentName({ commit }, envName) {
        commit("SET_ENVIRONMENT_NAME", { envName });
    },

    // effectively async
    updateEnvironment({getters, commit, dispatch, rootGetters}, {env, envName, patch}) {
        const _envName = env || envName
        let _env
        if(typeof _envName != 'string') {
            _env = _envName
        } else {_env = getters.lookupEnvironment(_envName)}

        Object.assign(_env, patch)
        commit('resetEnvironments')

        commit('setUpdateObjectPath', `environments.json`, {root: true})
        commit('setUpdateObjectProjectPath', rootGetters.getHomeProjectPath, {root: true})
        commit(
            'pushPreparedMutation', 
            _ => {
                return [ {typename: 'DeploymentEnvironment', target: _env.name, patch: _env}]
            },
            {root: true}
        )
        return dispatch('commitPreparedMutations', null,  {root: true})
    },


    async fetchProjectEnvironments({commit}, {fullPath}) {
        const query = gql`
        query getProjectEnvironments($fullPath: ID!) {
            project(fullPath: $fullPath) {
                environments {
                    nodes {
                        deploymentEnvironment @client {
                            connections
                            primary_provider
                        }
                        clientPayload
                        name
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
            if(errors) {throw new Error(errors)}

            environments = data.project.environments.nodes.map(environment => {
                Object.assign(environment, environment.deploymentEnvironment)
                delete environment.deploymentEnvironment
                delete environment.clientPayload
                environment.__typename = 'DeploymentEnvironment' // just documenting this to avoid confusion with __typename Environment
                connectionsToArray(environment)

                return environment
            })

        }
        catch(e){
            console.error('could not fetch project environments')
            console.error(e)
            environments = []

        }

        commit('setProjectEnvironments', environments)

    },
    async fetchEnvironments({ commit, dispatch, rootGetters }, {fullPath, projectPath}) {
        return await dispatch('fetchProjectEnvironments', {fullPath: fullPath || projectPath})
        /*
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
        */

    }
};
function envFilter(name){
    return env => env.name == name
} 

const getters = {
    getEnvironmentName: _state => _state.environmentName,
    getEnvironments: state => state.projectEnvironments,
    lookupEnvironment: (_, getters) => function(name) {return getters.getEnvironments.find(envFilter(name))},
    getValidConnections: state => function(environmentName, requirement) {
        let constraintType
        if(typeof requirement != 'string') { constraintType = requirement?.constraint?.resourceType 
        } else { constraintType  = requirement }
        const filter = envFilter(environmentName)
        const environment = state.environments.find(filter) || state.projectEnvironments.find(filter)
        //if(!environment) {throw new Error(`Environment ${environmentName} not found`)}
        if(!environment) return []
        let result = []
        if(environment.connections) environment.connections.filter(conn => conn.type && conn.type == constraintType)
        return result
    },
    getMatchingEnvironments: (state, getters) => function(type) {
        if(!type) { return getters.getEnvironments }
        const result = getters.getEnvironments.filter(env => {
            if(env?.primary_provider) return lookupCloudProviderAlias(env.primary_provider.type) == lookupCloudProviderAlias(type)
            else return true
        })
        return result
    },
    getDefaultEnvironmentName: (_, getters) => function(type) {
        if(!type) return null
        return getters.getMatchingEnvironments(type).find(env => env.primary_provider && lookupCloudProviderAlias(env.primary_provider.type) == lookupCloudProviderAlias(type))?.name
    },
    lookupConnection: state => function(environmentName, connectedResource) {
        const filter = envFilter(environmentName)
        const environment = state.environments.find(filter) || state.projectEnvironments.find(filter)
        //if(!environment) {throw new Error(`Environment ${environmentName} not found`)}
        if(! Array.isArray(environment?.connections) ) return null
        return _.cloneDeep(environment.connections.find(conn => conn.type && conn.name == connectedResource))
    }
};

export default {
    state,
    mutations,
    actions,
    getters
};
