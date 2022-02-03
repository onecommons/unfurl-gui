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
    async fetchDeployments({commit}, params) {
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

    }
};
const getters = {
    getDeployments: (state) => state.deployments || [],
    getNextDefaultDeploymentName: (state) => function(templateTitle) {
        const re = new RegExp(`${templateTitle} (\\d+)`)
        let max = 1
        for(const deployment of state.deployments) {
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
