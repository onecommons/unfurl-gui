import gql from 'graphql-tag';
import graphqlClient from '../../graphql';

const state = {loaded: false, callbacks: []};
const mutations = {
    setDeployments(state, deployments) {
        state.deployments = deployments;
    },
};
const actions = {
    async fetchDeployments({commit}, params) {
        const {projectPath, fullPath, fetchPolicy, applicationBlueprint} = params;
        const query = gql`
          query getDeployments($projectPath: ID!, $applicationBlueprint: ID), {
              deployments(projectPath: $projectPath, applicationBlueprint: $applicationBlueprint)
          }
        `;

        const result = await graphqlClient.defaultClient.query({
            query,
            variables: {
                ...params,
                fullPath: projectPath || fullPath,
            },
            fetchPolicy

        });
        const {data, errors} = result;

        commit('setDeployments', data.deployments);

    }
};
const getters = {
    getDeployments: (state) => state.deployments || []
};


export default {state, mutations, actions, getters};
