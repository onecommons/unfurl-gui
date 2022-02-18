<script>
import {debounce} from 'lodash';
import {bus} from '../../bus';
import {__} from '~/locale';
import {mapMutations, mapGetters} from 'vuex'
import {FormProvider, createSchemaField} from "@formily/vue";
import {FormItem, Input} from "@formily/element";
import {createForm, onFieldValueChange} from "@formily/core";
import {updatePropertyInResourceTemplate} from '../../store/modules/deployment_template_updates.js'

const ComponentMap = {
  string: 'Input',
  boolean: 'Checkbox',
  number: 'InputNumber',
  enum: 'Select',
  object: 'Editable.Popover',
  password: 'Password',
};

const ValidationFunctions = {
  string(input, value) {
    return !input.required || !!(value?.length)
  },
  number(input, value) {
    if(typeof value == 'string' && value.length == 0) return false
    return !input.required || !isNaN(value)
  }

}

function validateInput(input, value) {
  if(input?.type) {
    const result = ValidationFunctions[input.type](input, value)
    return result
  }
  return false
}

const fields = createSchemaField({
  components: {
    FormItem,
    Input
  }
})


export default {
  name: 'OcInputs',
  components: {
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
    card: {
      type: Object
    },
    /*
    mainInputs: {
      type: Array,
      required: true
    },
    componentKey: {
      type: Number,
      required: true
    }
    */
  },

  computed: {
    ...mapGetters(['resolveResourceType', 'cardInputsAreValid']),

    mainInputs() {
      const result = []
      let fromSchema, templateProperties
      try {
        fromSchema = this.resolveResourceType(this.card.type).inputsSchema.properties
        templateProperties = this.card.properties
      }
      catch(e) { return result }
      for (const property of templateProperties) {
        try{
          const next = {...property, ...fromSchema[property.name]}
          next.initialValue = next.value || next.default
          result.push(next)
        } catch (e) {
          throw new Error(`No schema definition for '${property.name}' on Resource Type '${this.card.type.name}'`)
        }
      }

      return result

    },

    initialFormValues() {
      const result = this.mainInputs.reduce((a, b) => Object.assign(a, {[b.name]: b.initialValue}), {})
      return result
    },

    schema() {
      const result =  {
        type: this.card?.type?.inputsSchema?.type,
        properties: this.mainInputs?.reduce((previousValue, currentValue, currentIndex, array) => {
          //const title = `${currentValue.title}${currentIndex}${this.componentKey}${this.getRandomKey(7)}-template`;
          const title = currentValue.name
          previousValue[title] = {
            type: 'string',//currentValue.type,
            title: currentValue.title,
            'x-decorator': 'FormItem',
            'x-component': 'Input',//ComponentMap[currentValue.type],
            'description': currentValue.instructions,
            'x-data': currentValue,
            'x-component-props': {
              placeholder: currentValue.title,
            },
          }
          return previousValue;
        }, {}),
      }
      return result
    },

    form() {
      return createForm({
        initialValues: this.initialFormValues,
        effects: () => {
          onFieldValueChange('*', async (field) => {
            this.triggerSave(field.data, field.value);
          })
        }
      })
    }
  },

  methods: {
    ...mapMutations([
      'pushPreparedMutation', 'setInputValidStatus'
    ]),
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

    updateFieldValidation(field, value) {
      this.setInputValidStatus({card: this.card, input: field, status: validateInput(field, value)})
    },

    triggerSave: debounce(function preview(field, value) {
      this.updateFieldValidation(field, value)
      this.pushPreparedMutation(
        updatePropertyInResourceTemplate({templateName: this.card.name, propertyName: field.title, propertyValue: value})
      )
    }, 200),

    getRandomKey(length) {
      return Math.random().toString(36).replace(/[^a-z][0-9]+/g, '').substr(0, length);
    }
  }
}
</script>
<template>
  <div data-testid="oc_inputs">
    
          <!--gl-icon
              :size="14"
              :class="{
                            'icon-green':
                                cardInputsAreValid(card),
                            'icon-red':
                                !cardInputsAreValid(card),
                            'gl-ml-4 gl-mt-1': true,
                        }"
              :name="
                            cardInputsAreValid(card)
                                ? 'check-circle-filled'
                                : 'warning-solid'
                        "/-->
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
  </div>
</template>
