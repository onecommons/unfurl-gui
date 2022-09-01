<script>
import { mapGetters, mapMutations } from 'vuex'
import { GlCard } from '@gitlab/ui'
import { Checkbox as ElCheckbox} from 'element-ui'
import { DetectIcon } from 'oc_vue_shared/oc-components'

export default {
    name: 'DeploymentScheduler',
    components: {
        GlCard,
        DetectIcon
    },
    data() {
        const incrementalDeploymentEnabled = true
        return {incrementalDeploymentEnabled}
    },
    methods: {
        ...mapMutations(['setIncrementalDeployment'])
    },
    watch: {
        incrementalDeploymentEnabled: {
            immediate: true,
            handler(val) {
                this.setIncrementalDeployment(val)
            }
        }
    },
    computed: {
        ...mapGetters(['hasIncrementalDeployOption'])
    }
}
</script>
<template>
    <gl-card v-if="hasIncrementalDeployOption" style="margin-top: -1.25em;">
        <div class="d-flex">
            <detect-icon size="24" name="expire" />
            <div class="ml-5">
                <el-checkbox v-model="incrementalDeploymentEnabled" label="Redeploy every time upstream dependencies are updated"/>
            </div>
        </div>
    </gl-card>

</template>
