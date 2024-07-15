import {mapGetters} from 'vuex'
import {getOrFetchDefaultBranch} from 'oc_vue_shared/client_utils/projects'

export const blueprintDefaultBranch = {
    data() {
        return {
            blueprintDefaultBranchPromise: null,
            blueprintDefaultBranch: null
        }
    },
    computed: {
        ...mapGetters(['getApplicationBlueprint'])
    },
    watch: {
        getApplicationBlueprint: {
            immediate: true,
            handler(val, prev) {
                if(val?.projectPath && val.projectPath != prev?.projectPath) {
                    this.blueprintDefaultBranchPromise = (
                        getOrFetchDefaultBranch(val.projectPath)
                    ) 
                }
            }
        },
        blueprintDefaultBranch(val) {
            val.then(resolved => this.blueprintDefaultBranch = resolved)
        }
    }
}

export const homeProjectDefaultBranch = {
    data() {
        return {
            homeProjectDefaultBranchPromise: null,
            homeProjectDefaultBranch: null
        }
    },
    computed: {
        ...mapGetters(['getHomeProjectPath'])
    },
    watch: {
        getHomeProjectPath: {
            immediate: true,
            handler(val, prev) {
                if(val?.projectPath && val.projectPath != prev?.projectPath) {
                    this.homeProjectDefaultBranchPromise = (
                        getOrFetchDefaultBranch(val.projectPath)
                    ) 
                }
            }
        },
        homeProjectDefaultBranch(val) {
            val.then(resolved => this.homeProjectDefaultBranch = resolved)
        }
    }
}

