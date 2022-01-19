<script>
import { GlTabs, GlTab, GlIcon, GlFormGroup, GlFormInput } from '@gitlab/ui';
import { debounce } from 'lodash';
import { bus } from '../../bus';
import { __ } from '~/locale';

export default {
    name: 'OcInputs',
    components: {
        GlTabs,
        GlTab,
        GlIcon,
        GlFormGroup,
        GlFormInput
    },

    props: {
        tabsTitle: {
            type: String,
            required: false,
            default: __('Inputs')
        },
        mainInputs: {
            type: Array,
            required: true
        },
        componentKey: {
            type: Number,
            required: true
        }
    },

    data() {
        return {
            inputsKey: 0,
            inputsComplete: null,
            autoSaveTimer: 3000
        }
    },

    mounted() {
        this.checkInputs();
    },

    methods: {
        checkInputs() {
            this.inputsComplete = this.mainInputs.length === this.mainInputs.filter((e) => e.value !== '').length;
            bus.$emit('completeMainInputs', this.inputsComplete);
        },

        refreshInputs() {
            this.inputsKey += 1;
        },

        checkInputsInline: debounce(function preview() {
            this.checkInputs();
        }, 300),

        triggerSave: debounce(function preview() {
            bus.$emit("triggerAutoSave");
        }, 100),

        getRandomKey(length) {
            return Math.random().toString(36).replace(/[^a-z][0-9]+/g, '').substr(0, length);
        }
    }
}
</script>
<template>
    <div :key="inputsKey">
        <gl-tabs>
            <gl-tab>
                <template slot="title">
                    <span>{{ tabsTitle }}</span>
                    <gl-icon
                        :size="14"
                        :class="{
                            'icon-green':
                                inputsComplete,
                            'icon-red':
                                !inputsComplete,
                            'gl-ml-4 gl-mt-1': true,
                        }"
                        :name="
                            inputsComplete
                                ? 'check-circle-filled'
                                : 'warning-solid'
                        "/>
                </template>
                <gl-form-group
                    v-for="(input, idx) in mainInputs"
                    :key="input.name+idx+componentKey+ 'group'"
                    :label="input.name"
                    class="col-md-4 align_left"
                >
                    <small>{{ input.instructions }}</small>
                    <gl-form-input
                        :id="input.name + idx + componentKey + getRandomKey(7)+'-template'"
                        v-model="input.value"
                        type="text"
                        :placeholder="input.name"
                        @keyup="checkInputsInline(); triggerSave()"
                    />
                </gl-form-group>
            </gl-tab>
        </gl-tabs>
    </div>
</template>
