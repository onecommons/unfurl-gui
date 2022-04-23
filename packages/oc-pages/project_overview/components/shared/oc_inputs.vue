<script>
import _ from 'lodash';
import {bus} from 'oc_vue_shared/bus';
import {__} from '~/locale';
import {mapActions, mapMutations, mapGetters} from 'vuex'
import {FormProvider, createSchemaField} from "@formily/vue";
import {FormLayout, FormItem, ArrayItems, Input, InputNumber, Checkbox, Select, Password, Editable, Space} from "@formily/element";
import {createForm, onFieldInputValueChange} from "@formily/core";

const ComponentMap = {
  string: 'Input',
  boolean: 'Checkbox',
  number: 'InputNumber',
  enum: 'Select',
  object: 'Editable.Popover',
  array: 'ArrayItems',
  password: 'Password',
};

const SerializationFunctions = {
  number(input, value) {
    const result = parseInt(value)
    if(!isNaN(result)) return result
  },
  array(input, value) {
    const result = []
    for(const item of value) {
      result.push(item['input'])
    }
    return result
  }
}
function serializeInput(input, value) {
  let type = input?.type
  let propertyName = input.name
  if(input.name?.endsWith('.input')) {
    type = 'arrayItem'
    propertyName = propertyName.slice(0, -6)
  }
  let result
  if(type) {
    const serializer = SerializationFunctions[type]
    if(typeof serializer == 'function') {
      result = [propertyName, serializer(input, value)]
    }
  }

  return (result || [propertyName, value])

}

const fields = createSchemaField({
  components: {
    FormItem,
    ArrayItems,
    Space,
    Input,
    InputNumber, Checkbox, Select, Password, Editable
  }
})


export default {
  name: 'OcInputs',
  components: {
    FormProvider,
    FormLayout,
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
  },

  data() {
    return {
      form: null,
      mainInputs: [],
      saveTriggers: {}
    }
  },
  computed: {
    ...mapGetters(['resolveResourceType', 'cardInputsAreValid', 'lookupEnvironmentVariable']),

    fromSchema() {
      return this.resolveResourceType(this.card.type)?.inputsSchema?.properties || {}
    },

    /*
    mainInputs() {
      const result = []
      for (const property of this.card.properties) {
        try{
          const next = {...property, ...this.fromSchema[property.name]}
          next.initialValue = next.value || next.default
          result.push(next)
        } catch (e) {
          throw new Error(`No schema definition for '${property.name}' on Resource Type '${this.cardType.name}'`)
        }
      }

      return result

    },
    */

    initialFormValues() {
      const result = this.mainInputs.reduce((a, b) => Object.assign(a, {[b.name]: b.initialValue}), {})
      return result
    },

    cardType() {
      if(!this.card?.type) {
        throw new Error(`Card "${this.card.name}" does not have a type`)
      }
      const result = this.resolveResourceType(this.card?.type)
      if(!result) {
        throw new Error(`Could not lookup card type ${this.card?.type} for ${this.card.name}`)
      }
      return result
    },

    schema() {
      return {
        type: this.cardType?.inputsSchema?.type,
        properties: this.convertProperties(this.cardType?.inputsSchema?.properties || {}),
      }
    },

  },

  methods: {
    ...mapMutations([
      'pushPreparedMutation', 'setCardInputValidStatus'
    ]),
    ...mapActions([
      'updateProperty'
    ]),
    async validate() {
      let status = 'valid'
      try {
        await this.form.validate()
        for(const key of Object.keys(this.initialFormValues)) {
          await this.form.fields[key]?.validate()
        }
      } catch(e) {
        status = 'error'
      }
      this.updateFieldValidation(
        this.card, 
        status
      )
    },
    convertProperties(properties) {
      return _.mapValues(properties, (value, name) => {
        const currentValue = {...value, name};
        if (!currentValue.type) {
          currentValue.type = 'string'
        }
        currentValue.title = currentValue.title ?? name;
        currentValue['x-decorator'] = 'FormItem'
        if(currentValue.type == 'number') {
          currentValue['x-decorator-props'] = {
            className: 'oc-input-number'
          }
        }
        currentValue['x-data'] = value
        currentValue['x-component-props'] = {
          placeholder: currentValue.title
        }
        let componentType = currentValue.type;
        if (componentType === 'object' && currentValue.properties) {
          currentValue.properties = this.convertProperties(currentValue.properties)
        } else if (componentType === 'array') {
          const items = currentValue.items
          //items['x-decorator'] = 'ArrayItems.Item'
          //items['x-component'] = ComponentMap[items.type]
          currentValue.items = {
            type: 'object',
            'x-decorator': 'ArrayItems.Item',
            properties: {
              space: {
                type: 'void',
                'x-component': 'Space',
                properties: {
                  input: {
                    ...items,
                    'x-decorator': 'FormItem',
                    'x-component': ComponentMap[items.type]
                  },
                  remove: {
                    type: 'void',
                    'x-decorator': 'FormItem',
                    'x-component': 'ArrayItems.Remove'
                  }
                }
              }
            }
          }
          currentValue.properties = {
            add: {
              type: 'void',
              title: 'Add',
              'x-component': 'ArrayItems.Addition'
            }
          }
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

    updateFieldValidation(field, status) {
      this.setCardInputValidStatus({card: this.card, status})
    },

    triggerSave(field, value) {
      const propertyName = field.name
      // debounce each property of a form separately in for autocomplete
      let triggerFn
      if(!(triggerFn = this.saveTriggers[propertyName])) {
        this.saveTriggers[propertyName] = triggerFn = _.debounce((function(field, value) {
          // TODO move cloneDeep/serializer into another function
          const propertyValue = _.cloneDeepWith(value, function(value) {
            if(Array.isArray(value) && value.length > 0) {
              return value.map(o => o?.input? o?.input: o)
            }
          })
          this.updateProperty({deploymentName: this.$route.params.slug, templateName: this.card.name, propertyName: field.name, propertyValue, isSensitive: field.sensitive})
        }).bind(this), 200)
      }

      triggerFn(field, value)
    },

    getRandomKey(length) {
      return Math.random().toString(36).replace(/[^a-z][0-9]+/g, '').substr(0, length);
    },
    getMainInputs() {
      const self = this
      const result = []
      for (const property of this.card.properties) {
        try{
          const next = {...property, ...this.fromSchema[property.name]}
          next.initialValue = _.cloneDeepWith(next.value || next.default, function(value) {
            if(Array.isArray(value) && value.length > 0) {
              return value.map(input => ({input}))
            }
            if(value?.get_env) {
              return self.lookupEnvironmentVariable(value.get_env) || ''
            }
          })
          result.push(next)
        } catch (e) {
          console.error(e)
          throw new Error(`No schema definition for '${property.name}' on Resource Type '${this.cardType.name}'`)
        }
      }

      return result
    }
  },
  mounted() {
    this.mainInputs = this.getMainInputs()
    const form = createForm({
      initialValues: this.initialFormValues,
      effects: () => {
        onFieldInputValueChange('*', async (field, ...args) => {
          // I'm not sure this would work for autocomplete if we did on validate
          // on the other hand if we check valid here, I'm not sure whether it's updated or not yet
          // if(form.valid) this.triggerSave({...field.data, name: field.path.entire}, field.value);
          this.validate()
          const name = field.path.segments[0]
          const value = form.values[name]
          this.triggerSave({...field.data, name}, value);
        })
      }
    })
    this.form = form
    this.validate()
  }
}
</script>
<template>
<div class="oc-inputs" style="overflow-x: auto; max-width: 100%;" data-testid="oc_inputs">
  <FormProvider v-if="form" :form="form">
    <FormLayout
        :breakpoints="[680]"
        :layout="['vertical', 'horizontal']"
        :label-align="['left', 'left']"
        :label-wrap="true"
        feedback-layout="popover"
        tooltip-layout="icon"
    >
      <SchemaField :schema="schema"/>
    </FormLayout>
  </FormProvider>
</div>
</template>
<style scoped>
.oc-inputs {
  max-width: 100%;
  overflow: hidden;
}
.formily-element-form-default {
  display: inline-flex;
  flex-direction: column;
}
.formily-element-form-default > :global(*) {
  display: inline-flex !important;
  justify-content: flex-end;
  margin-bottom: 2.2em;
  flex-wrap: wrap;
}
.oc-inputs >>> .formily-element-form-item-control {
  position: relative;
}

.oc-inputs >>> .formily-element-form-item-control-content { justify-content: flex-end; }
.oc-inputs >>> .formily-element-form-item-extra {
  left: calc(100% - 300px);
  position: absolute;
  font-size: 0.9em;
  line-height: 1.1;
  max-height: 2.2em;
  overflow: hidden;
  margin-top: 0.1em;
}

.oc-inputs >>> .formily-element-form-item-control-content-component { 
  width: 300px;
  max-width: 300px;
}
.oc-inputs >>> .oc-input-number .formily-element-form-item-control-content-component { 
  width: 150px;
  max-width: 150px;
  margin-right: 150px;
}

</style>
