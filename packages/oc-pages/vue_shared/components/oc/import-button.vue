<script>
import {Button as ElButton} from 'element-ui'
import {importStatus} from '../../client_utils/github-import'
import {mapGetters} from 'vuex'

const {DISABLED, PENDING, AVAILABLE, IMPORTED} = importStatus

export default {
    name: 'ImportButton',
    components: {
        ElButton
    },
    props: {
        repoImport: Object
    },
    computed: {
        ...mapGetters(['getCurrentNamespace']),
        state() {return this.repoImport?.importStatus},
        loading() {return this.state == PENDING},
        disabled() {return this.state == DISABLED || this.state == IMPORTED},
        type() {
            return this.state >= 1? 'primary': 'default'
        },
        text() {
            switch(this.state) {
                case PENDING: return 'Importing'
                case IMPORTED: return 'Imported'
                default: return 'Import'
            }
        }
    },
    watch: {
        repoImport() {
            if(this.state == PENDING) {
                this.repoImport.pollChanges()
            }
        }
    },
    methods: {
        dispatchClick() {
            let event
            switch(this.state) {
                case AVAILABLE: 
                    event = 'startImport'
                    this.repoImport.importSelf(this.getCurrentNamespace)
                    break
                default:
                    break
            }

            if(event) {
                this.$emit(event)
            }
        }
    }
}
</script>
<template>
    <el-button v-if="repoImport" :loading="loading" :disabled="disabled" :type="type" @click="dispatchClick">{{text}}</el-button>
</template>
