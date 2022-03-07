<script>
import {mapGetters} from 'vuex'
import {GlCard, GlIcon} from '@gitlab/ui'
import {lookupCloudProviderAlias} from '../../vue_shared/util.mjs'
const DISPLAY_MAP = {
    [lookupCloudProviderAlias('gcp')]: 'Google Cloud',
    [lookupCloudProviderAlias('aws')]: 'AWS',
    [lookupCloudProviderAlias('azure')]: 'Azure',
    [lookupCloudProviderAlias('k8s')]: 'Kubernetes'
}

export default {
    name: 'DeployedBlueprints',
    components: {
        GlCard, GlIcon
    },
    computed: {
        ...mapGetters([
            'getTemplatesList'
        ])
    },
    methods: {
        displayCloudProvider(cp) {
            return DISPLAY_MAP[lookupCloudProviderAlias(cp)]
        }
    }
}
</script>
<template>
    <gl-card>
        <template #header>
            <div class="d-flex align-items-center">
                <gl-icon name="package" class="mr-2"/>
                <h5 class="mb-0 mt-0">
                    {{__('Deployment Blueprints')}}
                </h5>
            </div>
        </template>
        <div v-for="(blueprint, idx) in getTemplatesList" :key="blueprint.name">
            <hr v-if="idx != 0">
            <div class="row m-2">
                <div class="col-md-4">
                    <router-link to="#"><div> {{blueprint.title}} </div></router-link>
                    <div> {{blueprint.description}}</div>
                </div>
                <div class="col-md-4">
                    {{displayCloudProvider(blueprint.cloud)}}
                </div>
                <div class="col-md-4">
                    <router-link to="#"> <gl-icon name="upload" /> 0 Deployments </router-link>

                </div>

            </div>
        </div>
    </gl-card>
</template>
<style scoped>
hr {
    margin: 0.5rem -1rem;
}
</style>
