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
{
newApplicationBlueprint(fullPath: $projectPath) @client {
    __typename
    name
    
    deploymentTemplates (searchBySlug: $templateSlug){
      title
      slug
      cloud
      resourceTemplates {
        name
        title
        description
        type
        properties
        outputs
        requirements {
          title
          name
          match {
            name
            title
            description
            type
            properties
            outputs
          }

        }
      }
      primary {
        name
        title
        description
        type
        properties
        outputs
        requirements {
          title
          name
          match {
            name
            title
            description
            type
            properties
            outputs
          }

        }
      }
     }
  }
}`, 
            variables: {projectPath: this.$projectGlobal.projectPath, templateSlug: 'apostrophe-demo'}
            })

            console.log(data)
            return 
        }
        try {
            await this.$store.dispatch('fetchProjectInfo', { projectPath: this.$projectGlobal.projectPath, defaultBranch: this.$projectGlobal.defaultBranch});
            await this.$store.dispatch('fetchTemplateResources', { projectPath: this.$projectGlobal.projectPath, templateSlug: this.$route.params.slug});
            await this.$store.dispatch('fetchEnvironments', { projectPath: this.$projectGlobal.projectPath});
            await this.$store.dispatch('fetchServicesToConnect', {projectPath: this.$projectGlobal.projectPath});
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
    }
}
</script>
<template>
    <div v-if="!shouldTestQueries" id="OcAppDeployments">
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
