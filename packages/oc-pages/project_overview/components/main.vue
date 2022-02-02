<script>
import createFlash, { FLASH_TYPES } from '~/flash';
import { __ } from '~/locale';
import gql from 'graphql-tag'
import graphqlClient from '../graphql';

export default {
    name: 'MainComponent',

    async beforeCreate() {
        if(location.search == '?test-queries') {
            const {data} = await  graphqlClient.clients.defaultClient.query({
                query: gql`

                  query getUnfurlRoot($fullPath: ID!) {
                      applicationBlueprint(fullPath: $fullPath) @client {
                          applicationBlueprint 
                          ResourceType

                      }
                  }

`, 
            variables: {dehydrated: true, fullPath: this.$projectGlobal.projectPath, templateSlug: 'apostrophe-demo'}
            })

            console.log(data)
            window.data = data
            return 
        }
        try {
            const {projectPath} = this.$projectGlobal
            await this.$store.dispatch('fetchProjectInfo', { projectPath, defaultBranch: this.$projectGlobal.defaultBranch});
            await this.$store.dispatch('fetchEnvironments', projectPath.split('/')[0]);
            await this.$store.dispatch('fetchServicesToConnect', {projectPath});
            this.fetchingComplete = true
            return true;
        } catch(err) {
            console.error(err)
            return createFlash({ message: err.message, type: FLASH_TYPES.ALERT });
        }
    },

    computed: {
        shouldTestQueries() {
            return location.search == '?test-queries'
        }
    },

    data() {
        return {
            fetchingComplete: false
        }
    }
}
</script>
<template>
    <div v-if="fetchingComplete && !shouldTestQueries" id="OcAppDeployments">
        <router-view />
    </div>
</template>
<style>
#OcAppDeployments {
    font-family: "Helvetica Neue";
    font-style: normal;
}
* {
    font-family: "Helvetica Neue";
}
button.dropdown-item:disabled {
    color: #9b9b9b;
}
</style>
