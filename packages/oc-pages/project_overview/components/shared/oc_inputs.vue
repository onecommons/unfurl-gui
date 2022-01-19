<script>
import {GlTabs, GlTab, GlIcon, GlFormGroup, GlFormInput} from '@gitlab/ui';
import {debounce} from 'lodash';
import {bus} from '../../bus';
import {__} from '~/locale';
import {FormProvider, createSchemaField} from "@formily/vue";
import {FormItem, Input} from "@formily/element";
import {createForm, onFieldValueChange} from "@formily/core";

const ComponentMap = {
  string: 'Input',
  boolean: 'Checkbox',
  number: 'InputNumber',
  enum: 'Select',
  object: 'Editable.Popover',
  password: 'Password',
};
const fields = createSchemaField({
  components: {
    FormItem,
    Input
  }
})


export default {
  name: 'OcInputs',
  components: {
    GlTabs,
    GlTab,
    GlIcon,
    // GlFormGroup,
    // GlFormInput,
    FormProvider,
    ...fields
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
      form: createForm({
        effects: () => {
          onFieldValueChange('*', async () => {
            this.checkInputsInline();
            this.triggerSave();
          })
        }
      }),
      inputsKey: 0,
      inputsComplete: null,
      autoSaveTimer: 3000,
      schema: {
        type: 'object',
        properties: this.mainInputs?.reduce((previousValue, currentValue, currentIndex, array) => {
          const title = `${currentValue.title}${currentIndex}${this.componentKey}${this.getRandomKey(7)}-template`;
          previousValue[title] = {
            type: 'string',
            title: currentValue.title,
            'x-decorator': 'FormItem',
            'x-component': 'Input',
            'description': currentValue.instructions,
            'x-data': currentValue,
            'x-component-props': {
              placeholder: currentValue.title,
            },
          }
          return previousValue;
        }, {}),
      }
    }
  },

  mounted() {

    this.checkInputs();
  },

  methods: {
    convertProperties(properties) {
      const temp = {};
      Object.keys(properties).forEach(i => {
        //default string
        let componentType = properties[i].type || 'string';
        // Special Handle Enum
        if (componentType === 'object') {
          temp[i] = {
            type: componentType,
            title: i,
            'x-decorator': 'FormItem',
            'x-component': ComponentMap[i],
            'x-component-props': {
              title: i,
            },
            properties: this.convertProperties(properties[i].properties),
          };
        } else {
          // json type is no enum filed,so containing enum fields is render Select;
          if (properties[i].enum) {
            componentType = 'enum';
          } else if (properties[i].sensitive) {
            componentType = 'password';
          }
          temp[i] = {
            type: properties[i].type || 'string',
            title: i,
            'x-decorator': 'FormItem',
            'x-component': ComponentMap[componentType],
          };

          if (componentType === 'enum') {
            temp[i].enum = properties[i].enum;
          }

          if (properties[i].default) {
            temp[i].default = properties[i].default;
          }

          if (properties[i].const === null) {
            temp[i]['x-hidden'] = true;
          }

          if (properties[i].const === 'readonly') {
            temp[i]['x-read-only'] = true;
          }
        }
      });
      return temp;
    },

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

        <FormProvider :form="form">
          <SchemaField :schema="schema"/>
        </FormProvider>
<!--        <gl-form-group-->
        <!--            v-for="(input, idx) in mainInputs"-->
        <!--            :key="input.title+idx+componentKey+ 'group'"-->
        <!--            :label="input.title"-->
        <!--            class="col-md-4 align_left"-->
        <!--        >-->
        <!--          <small>{{ input.instructions }}</small>-->
        <!--          <gl-form-input-->
        <!--              :id="input.title + idx + componentKey + getRandomKey(7)+'-template'"-->
        <!--              v-model="input.value"-->
        <!--              type="text"-->
        <!--              :placeholder="input.title"-->
        <!--              @keyup="checkInputsInline(); triggerSave()"-->
        <!--          />-->
        <!--        </gl-form-group>-->
      </gl-tab>
    </gl-tabs>
  </div>
</template>
