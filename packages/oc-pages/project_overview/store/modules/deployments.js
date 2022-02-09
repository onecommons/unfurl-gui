import gql from 'graphql-tag';
import graphqlClient from '../../graphql';
import {USER_HOME_PROJECT} from '../../../vue_shared/util.mjs'

const state = {loaded: false, callbacks: []};
const mutations = {
    setDeployments(state, deployments) {
        state.deployments = deployments;
    },
};
const actions = {
    // NOTE this is done in the environments store
    async fetchDeployments({commit}, params) {
        /*
        const {username, projectPath, fullPath, fetchPolicy, applicationBlueprint} = params;
        const query = gql`
          query getDeployments($projectPath: ID!, $applicationBlueprint: ID), {
              deployments(projectPath: $projectPath, applicationBlueprint: $applicationBlueprint)
          }
        `;

        let deployments = []
        try {

            const result = await graphqlClient.defaultClient.query({
                query,
                variables: {
                    ...params,
                    projectPath: projectPath || fullPath || `${username}/${USER_HOME_PROJECT}`,
                },
                fetchPolicy

            });

            const {data, errors} = result;
            if(data?.deployments) deployments = data.deployments
        } catch(e) {
            console.error(e)

        }

        commit('setDeployments', deployments);
        */

    }
};
const getters = {
    getDeploymentDictionary(state) {
        return function(deploymentName, environmentName) {
            for(const dict of state.deployments) {
                const deployment = dict.Deployment[deploymentName]
                if(deployment && dict._environment == environmentName) // _environment assigned on fetch in environments store
                    return dict
            }
            return null
        }
    },
    getDeploymentDictionaries(state) {
        return state.deployments
    },
    getDeployments(state) {
        if(!state.deployments) return []
        const result = []
        for(const dict of state.deployments) {
            if(typeof dict?.Deployment != 'object') continue
            Object.values(dict.Deployment).forEach(dep => {
                result.push({...dep, _environment: dict._environment}) // _environment assigned on fetch in environments store
            })
        }
        return result
    },
    getDeploymentsByEnvironment(_, getters) {
        return function(environment) {
            if(!environment) {
                return getters.getDeployments
            }
            return getters.getDeployments.filter(dep => dep.name == environment)
        }
    },
    getNextDefaultDeploymentName: (_, getters) => function(templateTitle, environment) {
        const re = new RegExp(`${templateTitle} (\\d+)`)
        let max = 1
        // use below if we want to count from one for each environment
        // for(const deployment of getters.getDeploymentsByEnvironment(environment)) { 
        for(const deployment of getters.getDeployments) {
            let match = deployment.title.match(re)
            if(match) {
                match = parseInt(match[1])
                if(match >= max) { max = match + 1 }
            }
        }

        return `${templateTitle} ${max}`

    }
};


export default {state, mutations, actions, getters};
