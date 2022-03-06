<script>
import _ from 'lodash';
import {bus} from '../../bus';
import {__} from '~/locale';
import {mapActions, mapMutations, mapGetters} from 'vuex'
import {FormProvider, createSchemaField} from "@formily/vue";
import {FormItem, Input, InputNumber, Checkbox, Select, Password, Editable} from "@formily/element";
import {createForm, onFieldValueChange} from "@formily/core";

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
    if(typeof ValidationFunctions[input.type] != 'function') return true
    const result = ValidationFunctions[input.type](input, value)
    return result
  }
  return false
}

const SerializationFunctions = {
  number(input, value) {
    return parseInt(value)
  }
}
function serializeInput(input, value) {
  if(input?.type) {
    const serializer = SerializationFunctions[input.type]
    if(typeof serializer == 'function') {
      return serializer(input, value)
    }
  }

  return value
}

const fields = createSchemaField({
  components: {
    FormItem,
    Input,
    InputNumber, Checkbox, Select, Password, Editable
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
    ...mapGetters(['resolveResourceTypeFromAvailable', 'cardInputsAreValid']),

    mainInputs() {
      const result = []
      let fromSchema, templateProperties
      try {
        fromSchema = this.resolveResourceTypeFromAvailable(this.card.type).inputsSchema.properties
        templateProperties = this.card.properties
      }
      catch(e) { return result }
      if(! templateProperties) return []
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

    cardType() {
      return this.resolveResourceTypeFromAvailable(this.card?.type)
    },

    schema() {
      return {
        type: this.cardType?.inputsSchema?.type,
        properties: this.convertProperties(this.cardType?.inputsSchema?.properties || {}),
      }
    },

    form() {
      return createForm({
        initialValues: this.initialFormValues,
        effects: () => {
          onFieldValueChange('*', async (field, ...args) => {
            if(!field.modified) return
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
    ...mapActions([
      'updateProperty'
    ]),
    convertProperties(properties) {
      return _.mapValues(properties, (value, name) => {
        const currentValue = {...value};
        if (!currentValue.type) {
          currentValue.type = 'string'
        }
        currentValue.title = currentValue.title ?? name;
        currentValue['x-decorator'] = 'FormItem'
        currentValue['x-data'] = value
        currentValue['x-component-props'] = {
            placeholder: currentValue.title,
        }
        let componentType = currentValue.type;
        if (componentType === 'object' && currentValue.properties) {
          currentValue.properties = this.convertProperties(currentValue.properties)
        } else {
          if (currentValue.enum) {
            componentType = 'enum';
          } else if (currentValue.sensitive) {
            componentType = 'password';
          }
          if (currentValue.const === null) {
            currentValue['x-hidden'] = true;
          } else if (currentValue.const === 'readonly') {
            currentValue['x-read-only'] = true;
          }
        }
        currentValue['x-component'] = ComponentMap[componentType]
        return currentValue;
      });
    },

    updateFieldValidation(field, value) {
      this.setInputValidStatus({card: this.card, input: field, status: validateInput(field, value)})
    },

    triggerSave: _.debounce(function preview(field, value) {
      this.updateFieldValidation(field, value)
      const propertyValue = serializeInput(field, value)
      this.updateProperty({deploymentName: this.$route.params.slug, templateName: this.card.name, propertyName: field.title, propertyValue, isSensitive: field.sensitive})
    }, 200),

    getRandomKey(length) {
      return Math.random().toString(36).replace(/[^a-z][0-9]+/g, '').substr(0, length);
    }
  }
}
</script>
<template>
  <div style="overflow-x: auto; max-width: 100%;" data-testid="oc_inputs">
    
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
