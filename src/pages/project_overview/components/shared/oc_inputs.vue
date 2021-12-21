<script>
import { GlTabs, GlTab, GlIcon, GlFormGroup, GlFormInput } from '@gitlab/ui';
import { debounce } from 'lodash';
import { bus } from '../../index';
import { __ } from '~/locale';
import $ from 'jquery'

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
        bool_data: {
            type: Boolean
        },
        componentKey: {
            type: Number,
            required: true
        }
    },

    data() {
        return {
            inputsKey: 0,
            bool_val:0,
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
            this.bool_val = this.mainInputs.filter((e) => e.value !== '').length;
            bus.$emit('completeMainInputs', this.inputsComplete);
        },

        refreshInputs() {
            this.inputsKey += 1;
        },
        defaultValues(){
            this.mainInputs.forEach((e)=>{
                $('.'+e.title).val(e.default)
                // $('.'+e.title).val("2")
                e.value = e.default
            })
            bus.$emit('defaultMainInputs',this.mainInputs)
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
<style>
    .usedefaultbtn{
        position: absolute;
        right: 18px;
        padding: 4px 8px;
        border: 1px solid #d6d1e0;
        border-radius: 3px;
        display: flex;
        align-items: center;
    }
    .usedefaultbtntext{
        font-weight: 400;
        margin-left: 4px;
    }
</style>
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
                        <gl-button v-if="bool_data && bool_val" icon="close" class="usedefaultbtn" aria-label="Close" @click="defaultValues()"> 
                                <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 13.5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5h9.25a.75.75 0 0 0 0-1.5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.75a.75.75 0 0 0-1.5 0V13a.5.5 0 0 1-.5.5H3Zm12.78-8.82a.75.75 0 0 0-1.06-1.06L9.162 9.177 7.289 7.241a.75.75 0 1 0-1.078 1.043l2.403 2.484a.75.75 0 0 0 1.07.01L15.78 4.68Z" fill="#000"/></svg>
                                <div class="usedefaultbtntext">Use Default</div>
                        </gl-button>
                </template>
                <gl-form-group
                    v-for="(input, idx) in mainInputs"
                    :key="input.title+idx+componentKey+ 'group'"
                    :label="input.title"
                    class="col-md-4 align_left"
                >
                    <small>{{ input.instructions }}</small>
                    <gl-form-input
                        :id="input.title + idx + componentKey + getRandomKey(7)+'-template'"
                        v-model="input.value"
                        :class="input.title"
                        type="text"
                        :placeholder="input.title"
                        @keyup="checkInputsInline(); triggerSave()"
                    />
                </gl-form-group>
            </gl-tab>
        </gl-tabs>
    </div>
</template>
