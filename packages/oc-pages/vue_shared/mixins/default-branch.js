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
                        getOrFetchDefaultBranch(encodeURIComponent(val.projectPath))
                    )
                }
            }
        },
        blueprintDefaultBranchPromise: {
            immediate: true,
            handler(val) {
                val.then(resolved => this.blueprintDefaultBranch = resolved)
            }
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
                if(val && val != prev) {
                    this.homeProjectDefaultBranchPromise = (
                        getOrFetchDefaultBranch(encodeURIComponent(val))
                    )
                }
            }
        },
        homeProjectDefaultBranchPromise: {
            immediate: true,
            handler(val) {
                val.then(resolved => this.homeProjectDefaultBranch = resolved)
            }
        }
    }
}

