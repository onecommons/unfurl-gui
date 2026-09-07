<script>
import {GlButton} from '@gitlab/ui'
import {importStatus} from '../../client_utils/github-import'
import {mapGetters} from 'vuex'

const {DISABLED, PENDING, AVAILABLE, IMPORTED} = importStatus

export default {
    name: 'ImportButton',
    components: {
        GlButton
    },
    props: {
        repoImport: Object
    },
    computed: {
        ...mapGetters(['getCurrentNamespace']),
        state() {return this.repoImport?.importStatus},
        loading() {return this.state == PENDING},
        disabled() {return this.state == DISABLED || this.state == IMPORTED},
        variant() {
            return this.state >= 1? 'confirm': 'default'
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
                this.emitFinishedImport()
            }
        }
    },
    methods: {
        async dispatchClick() {
            let event
            switch(this.state) {
                case AVAILABLE: 
                    event = 'startImport'
                    await this.repoImport.importSelf(this.getCurrentNamespace)
                    this.emitFinishedImport()
                    break
                default:
                    break
            }

            if(event) {
                this.$emit(event)
            }
        },
        emitFinishedImport() {
          const emit = this.$emit.bind(this, 'importFinished')
          this.repoImport.pollPromise.then(emit)
        }
    }
}
</script>
<template>
    <gl-button data-testid="import-button" v-if="repoImport" :loading="loading" :disabled="disabled" :variant="variant" @click="dispatchClick">{{text}}</gl-button>
</template>
