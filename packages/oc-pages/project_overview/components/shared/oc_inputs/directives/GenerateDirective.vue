<script>
import {mapGetters} from 'vuex'
import {tryResolveDirective} from 'oc_vue_shared/lib'
import {GlButton, GlModal} from '@gitlab/ui'

export default {
    name: 'GenerateDirective',
    f: null,
    data() {
        return {...this.$options.f(), showModal: false}
    },
    components: {
        GlButton, GlModal
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
            const testid = this.property['x-component-props']['data-testid']
            // scope to the field's decorator rather than walking up to a
            // widget-library class name
            const sharedAncestor = this.$el.closest(`[data-testid="${testid}-item"]`) || document

            // the testid may sit on the input itself or on a wrapper around it
            const tagged = sharedAncestor.querySelector(`[data-testid="${testid}"]`)
            const el = tagged?.matches('input, textarea')? tagged: tagged?.querySelector('input, textarea')

            if(!el) {
                console.warn(`Could not resolve an input for ${testid}`)
                return
            }

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
        <gl-button :data-testid="`${property['x-component-props']['data-testid']}-generate`" icon="bulb" @click="assignGenerated(false)">Generate</gl-button>
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
