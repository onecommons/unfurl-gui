<script>
import createFlash, { FLASH_TYPES } from '~/flash';
import { __ } from '~/locale';


export default {
    name: 'MainComponent',

    async beforeCreate() {
        try {
            await this.$store.dispatch('fetchTemplateResources', { projectPath: this.$projectGlobal.projectPath, defaultBranch: this.$projectGlobal.defaultBranch});
            await this.$store.dispatch('fetchProjectInfo', { projectPath: this.$projectGlobal.projectPath, defaultBranch: this.$projectGlobal.defaultBranch});
            await this.$store.dispatch('fetchEnvironments', { projectPath: this.$projectGlobal.projectPath});
            await this.$store.dispatch('fetchServicesToConnect', {projectPath: this.$projectGlobal.projectPath});
            return true;
        } catch(err) {
            return createFlash({ message: err.message, type: FLASH_TYPES.ALERT });
        }
    }
}
</script>
<template>
    <div id="OcAppDeployments">
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
