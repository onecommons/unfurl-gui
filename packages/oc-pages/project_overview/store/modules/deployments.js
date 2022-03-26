import gql from 'graphql-tag';
import graphqlClient from '../../graphql';
import {slugify, USER_HOME_PROJECT} from '../../../vue_shared/util.mjs'
import _ from 'lodash'

const state = {loaded: false, callbacks: []};
const mutations = {
    setDeployments(state, deployments) {
        state.deployments = deployments;
    },
};
const actions = {
    // NOTE this is done in the environments store
    async fetchDeployments({commit}, params) {
        console.warn('fetch deployments has no effect and will be removed')
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
                if(!dict.Deployment) continue
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
            if(_.isObject(dict.Deployment)) continue
            Object.values(dict.Deployment).forEach(dep => {
                result.push({...dep, _environment: dict._environment}) // _environment assigned on fetch in environments store
            })
        }
        return result
    },
    getDeploymentsOrDrafts() {
        if(!state.deployments) return []
        const result = []
        for(const dict of state.deployments) {
            const deployment = _.isObject(dict.Deployment)? dict.Deployment: dict.DeploymentTemplate
            if(!deployment) continue
            Object.values(deployment).forEach(dep => {
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
            return getters.getDeployments.filter(dep => dep._environment == environment)
        }
    },
    getNextDefaultDeploymentName: (_, getters) => function(templateTitle, environment) {
        const re = new RegExp(`${templateTitle} (\\d+)`)
        let max = 1
        // use below if we want to count from one for each environment
        // for(const deployment of getters.getDeploymentsByEnvironment(environment)) { 
        //
        // update - this used to use getDeployments but is now using getDeploymentsOrDrafts
        for(const deployment of getters.getDeploymentsOrDrafts) {
            let match = deployment.title.match(re)
            if(match) {
                match = parseInt(match[1])
                if(match >= max) { max = match + 1 }
            }
        }

        return `${templateTitle} ${max}`
    },
    lookupDeploymentOrDraft(_, getters) {
        return function(deploymentName, environment) {
            const _environment = environment?.name || environment
            const result = getters.getDeploymentsOrDrafts.find(dep => dep._environment == _environment && dep.name == deploymentName)
            return result
        }

    },
    lookupDeployment(_, getters) {
        return function(deploymentName, environment) {
            const deployments = environment?
                getters.getDeploymentsByEnvironment(environment) :
                getters.getDeployments
            const result = deployments.find(dep => dep.title == deploymentName || dep.name == slugify(deploymentName))
            return result
        }
    }
};


export default {state, mutations, actions, getters};
