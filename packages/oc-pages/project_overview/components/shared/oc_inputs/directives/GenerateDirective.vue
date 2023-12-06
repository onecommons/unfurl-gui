<script>
import {mapGetters} from 'vuex'
import {tryResolveDirective} from 'oc_vue_shared/lib'
import {Button as ElButton} from 'element-ui'
import {GlModal} from '@gitlab/ui'

export default {
    name: 'GenerateDirective',
    f: null,
    data() {
        return {...this.$options.f(), showModal: false}
    },
    components: {
        ElButton, GlModal
    },
    computed: {
        ...mapGetters(['resolveResourceTypeFromAny']),
        propertyDefault() {
            return this.inputsSchema.properties[this.property.name]?.default
        },
        generated() {
            return tryResolveDirective(this.propertyDefault)
        }
    },
    methods: {
        assignGenerated(force=false) {
            let sharedAncestor = this.$el.parentNode

            while(!sharedAncestor.classList.contains('formily-element-form-item-control-content')) {
                sharedAncestor = sharedAncestor.parentNode
            }

            const el = sharedAncestor.querySelector(`[data-testid="${this.property['x-component-props']['data-testid']}"] input`)

            if((!force) && el.value) {
                this.showModal = true
                return
            }
            el.value = this.generated
            el.dispatchEvent(new InputEvent('input'))
        }
    },
    created() {
        Object.assign(this, this.$options.f())
    }
}
</script>
<template>
    <div class="position-absolute ml-1">
        <el-button icon="el-icon-s-opportunity" @click="assignGenerated(false)">Generate</el-button>
        <gl-modal
            v-model="showModal"
            @primary="assignGenerated(true)"
            :action-primary="{text: 'Yes'}"
            :action-cancel="{text: 'Cancel'}"
            :modal-id="['generate-directive', card.name, property.name].join('.')"
        >
            <template #modal-header>
                Are you sure you want to generate a new value for {{property.name}}?
            </template>
        </gl-modal>
    </div>
</template>
<style>
[id^="generate-directive"].modal-body {
    display: none !important;
}
</style>
