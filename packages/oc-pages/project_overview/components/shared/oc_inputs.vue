<script>
import _ from 'lodash';
import {bus} from 'oc_vue_shared/bus';
import {__} from '~/locale';
import {mapActions, mapMutations, mapGetters} from 'vuex'
import {FormProvider, createSchemaField} from "@formily/vue";
import {FormLayout, FormItem, ArrayItems, Input, InputNumber, Checkbox, Select, Password, Editable, Space} from "@formily/element";
import {createForm, onFieldInputValueChange} from "@formily/core";
import {tryResolveDirective} from 'oc_vue_shared/lib'
import {getCustomInputComponent} from './oc_inputs'


const ComponentMap = {
  string: 'Input',
  boolean: 'Checkbox',
  number: 'InputNumber',
  enum: 'Select',
  object: 'Editable.Popover',
  array: 'ArrayItems',
  password: 'Password',
};

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
      saveTriggers: {},
      customComponent: null,
    }
  },
  computed: {
    ...mapGetters(['resolveResourceType', 'cardInputsAreValid', 'lookupEnvironmentVariable']),

    fromSchema() {
      return this.resolveResourceType(this.card.type)?.inputsSchema?.properties || {}
    },

    /*
    initialFormValues() {
      const result = this.mainInputs.reduce((a, b) => Object.assign(a, {[b.name]: b.initialValue}), {})
      return result
    },
     */

    formValues() {
      // element formily needs ?? undefined for some reason
      const result = this.mainInputs.reduce((a, b) => Object.assign(a, {[b.name]: b.value ?? undefined}), {})
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
      'pushPreparedMutation', 'setCardInputValidStatus', 'clientDisregardUncommitted'
    ]),
    ...mapActions([
      'updateProperty'
    ]),
    async validate() {
      let status = 'valid'
      try {
        await this.form.validate()
        for(const key of Object.keys(this.formValues)) {
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
          placeholder: currentValue.placeholder,
          'data-testid': `oc-input-${this.card.name}-${currentValue.name}`
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

    triggerSave(field, value, disregardUncommitted) {
      const propertyName = field.name
      // debounce each property of a form separately in for autocomplete
      let triggerFn
      if(!(triggerFn = this.saveTriggers[propertyName])) {
        this.saveTriggers[propertyName] = triggerFn = _.debounce((function(field, value, disregardUncommitted=false) {
          // TODO move cloneDeep/serializer into another function
          const propertyValue = _.cloneDeepWith(value, function(value) {
            if(Array.isArray(value) && value.length > 0) {
              return value.map(o => o?.input? o?.input: o)
            }
          })
          this.updateProperty({deploymentName: this.$route.params.slug, templateName: this.card.name, propertyName: field.name, propertyValue, isSensitive: field.sensitive})
          if(disregardUncommitted && !this.card._uncommitted) this.clientDisregardUncommitted()

        }).bind(this), 200)
      }

      triggerFn(field, value, disregardUncommitted)
    },

    getMainInputs() {
      const self = this
      const result = []
      for (const property of this.card.properties) {
        let overrideValue = false
        try{
          const next = {...property, ...this.fromSchema[property.name]}

          /*
           * uncomment to default to minimum
          if(next.type == 'number' && next.required && next.minimum && (next.default ?? null) === null) {
            next.default = next.minimum
          }
          */

          next.value = _.cloneDeepWith(next.value ?? next.default, function(value) {
            if(Array.isArray(value) && value.length > 0) {
              return value.map(input => ({input}))
            }
            if(value?.get_env) {
              overrideValue = true
              return self.lookupEnvironmentVariable(value.get_env) || ''
            }
            let resolvedDirective
            if(resolvedDirective = tryResolveDirective(value)) {
                next.dirty = true
                return resolvedDirective
            }
          })
          /*
          if(overrideValue) {
            next.value = next.initialValue
          }
           */
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
    const customComponent = getCustomInputComponent(this.card.type)
    if(customComponent) {
      this.customComponent = customComponent
      return
    }
    this.mainInputs = this.getMainInputs()
    const form = createForm({
        //initialValues: this.initialFormValues,
      values: this.formValues,
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
    for(const input of this.mainInputs) {
      if(input.dirty) {
        this.triggerSave(input, input.value || input.initialValue, true)
      }
    }
    
    this.validate()
  }
}
</script>
<template>
<div class="oc-inputs" style="overflow-x: auto; max-width: 100%;" data-testid="oc_inputs">
  <component :is="customComponent" v-if="customComponent" :card="card" />
  <FormProvider v-else-if="form" :form="form">
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
.gl-dark >>> input::placeholder {
    opacity: 0.7;
}
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

.gl-dark >>> .formily-element-form-item-label-content > label { 
  color: white;
}

.gl-dark >>> .formily-element-form-item-colon { 
  color: white;
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
@media only screen and (min-width: 430px) {
    .oc-inputs >>> .oc-input-number .formily-element-form-item-control-content-component { 
      width: 150px;
      max-width: 150px;
      margin-right: 150px;
    }
}

</style>
