<script>
import _ from 'lodash';
import {__} from '~/locale';
import Vue from 'vue'
import {mapActions, mapMutations, mapGetters} from 'vuex'
import {Card as ElCard} from 'element-ui'
import {resolverName, tryResolveDirective} from 'oc_vue_shared/lib'
import {fields, schemaFieldComponents, FormProvider, FormLayout, getCustomTooltip, getUiDirective} from './oc_inputs'
import {parseMarkdown} from 'oc_vue_shared/client_utils/markdown'
import { GlTabs } from '@gitlab/ui';

import OcTab from 'oc_vue_shared/components/oc/oc-tab.vue'


const ComponentMap = {
  string: 'Input',
  textarea: 'Input',
  file: 'FileSelector',
  boolean: 'Checkbox',
  number: 'InputNumber',
  enum: 'Select',
  object: 'Editable.Popover',
  array: 'ArrayItems',
  password: 'FakePassword',
};

export default {
  name: 'OcInputs',
  components: {
    FormProvider,
    FormLayout,
    OcTab,
    GlTabs,
    ElCard,
    ...schemaFieldComponents
  },

  props: {
    propertyPath: {
      type: Array,
      default: () => []
    },
    card: {
      type: Object
    },
    wrapper: {
      type: String,
      default: () => 'el-card'
    }
  },

  data() {
    return {
      form: null,
      mainInputs: [],
      saveTriggers: {},
      currentTabTitle: null,
    }
  },

  computed: {
    ...mapGetters(['resourceTemplateInputsSchema', 'resolveResourceTemplateType', 'cardInputsAreValid', 'lookupEnvironmentVariable', 'userCanEdit']),

    isNested() {
      return this.propertyPath.length > 0
    },

    inputsSchema() {
      let schema = this.resourceTemplateInputsSchema(this.card)
      for(const component of this.propertyPath) {
        schema = schema.properties[component]
      }

      return schema
    },

    schemaFields() {
      const schema = _.cloneDeep(this.inputsSchema)

      if(!schema.properties) schema.properties = {}
      if(schema.additionalProperties) {
        schema.properties['$additionalProperties'] = {
          additionalProperties: schema.additionalProperties,
          default: {}, // This default should be fine because we are using the base prop (or it's default) to determine the current value
          title: '',
          type: 'object',
          additionalPropertiesAddLabel: schema.additionalPropertiesAddLabel

        }
      }
      return schema.properties
    },

    formValues() {
      // element formily needs ?? undefined for some reason
      const result = this.mainInputs.reduce((a, b) => Object.assign(a, {[b.name]: b.value ?? b.default ?? undefined}), {})
      return result
    },

    schema() {
      return {
        type: this.inputsSchema?.type,
        properties: this.convertProperties(this.schemaFields),
      }
    },

    innerTabs() {
      if(!this.isNested) return []
      const tabs = Object.entries(this.schemaFields).filter(([_, value]) => value.tab_title
      ).map(([name, value]) => ({[name]: value}))

      return Object.assign({}, ...tabs)
    },

    tabTitles() {
      return Object.assign({}, ...Object.entries(this.innerTabs).map(([name, value]) => ({[value.tab_title]: name})))
    },

    displayForm() {
      return this.form && this.currentTabTitle == null
    },

    tabTooltip() {
      const last = _.last(this.propertyPath)
      if(!getCustomTooltip(last)) return null
      return {...getCustomTooltip(last), f: () => ({$store: this.$store, card: this.card, large: true})}
    }
  },

  methods: {
    ...mapMutations([
      'pushPreparedMutation', 'setInputValidStatus', 'clientDisregardUncommitted'
    ]),
    ...mapActions([
      'updateProperty'
    ]),
    async validate() {
      let status = 'valid'
      let path
      try {
        // was using this because without the onMount => validate() setup validating individual fields did nothing
        // await this.form.validate()

        for(const key of Object.keys(this.formValues)) {
          let formField
          try { formField = this.form.fields[key] }
          catch(e) {}
          // objects that are only parents of $additionalProperties have no data and can be skipped for validation
          if (formField && formField.data) {
            path = [...this.propertyPath, key].join('.')

            const {data, value} = formField
            if(value?.length === 0 && data.required && data.type == 'object' && data.additionalProperties?.required) {
              // skip validating empty required object
            } else {
              await formField.validate()
            }
            if(formField.invalid) {
              status = 'error'
            }
            this.updateFieldValidation(
              path,
              status
            )
          }
        }
      } catch(e) {
        status = 'error'
        this.updateFieldValidation(
          path || 'all',
          status
        )
      }
    },
    convertProperties(properties) {
      return _.mapValues(properties, (value, name) => {
        const currentValue = {...value, name};

        if(currentValue.sensitive && !this.userCanEdit) return null

        if(!currentValue.type) {
          currentValue.type = 'string'
        }

        currentValue.title = currentValue.title ?? name;
        currentValue['x-decorator'] = 'FormItem'
        currentValue['x-decorator-props'] = {}

        if(currentValue.type == 'number') {
          currentValue['x-decorator-props'].className = 'oc-input-number'
        }
        if(getCustomTooltip(name)) {
          currentValue['x-decorator-props'].tooltip = {...getCustomTooltip(name), f: () => ({$store: this.$store, card: this.card})}
        }
        if(currentValue.default?._generate) {
          currentValue['x-decorator-props'].addonAfter = {...getUiDirective('generate'), f: () => ({$store: this.$store, card: this.card, property: currentValue, inputsSchema: this.inputsSchema})}
        }

        currentValue.default = undefined
        currentValue['x-data'] = value

        let componentType = currentValue.type;

        currentValue['x-component-props'] = {
          placeholder: currentValue.placeholder || ' ',
          'data-testid': `oc-input-${this.card.name}-${currentValue.name}`,
          componentType,
          name,
          schema: value,
        }

        if(currentValue.input_type) {
          currentValue['x-component-props']['type'] = currentValue.input_type
        }

        if (currentValue.tab_title) {
          // we haven't figured out recursion yet
          return null;
        }
        if (componentType === 'object' && currentValue.properties) {
          currentValue.properties = this.convertProperties(currentValue.properties)
        } else if (componentType === 'object' && currentValue.additionalProperties) {
          currentValue.items = {
            type: 'object',
            'x-decorator': 'ArrayItems.Item',
            properties: {
              space: {
                type: 'void',
                'x-component': 'Space',
                properties: {
                  key: {
                    'x-decorator': 'FormItem',
                    'x-component': 'Input',
                    'x-component-props': {
                      placeholder: 'key'
                    }
                  },
                  value: {
                    'x-decorator': 'FormItem',
                    'x-component': ComponentMap[currentValue.additionalProperties.type],
                    'x-component-props': {
                      placeholder: 'value'
                    }
                  },
                  remove: {
                    type: 'void',
                    'x-decorator': 'FormItem',
                    'x-component': 'ArrayItems.Remove',
                  }
                }
              }
            }
          }
          currentValue.properties = {
            add: {
              type: 'void',
              title: currentValue.additionalPropertiesAddLabel || 'Add',
              'x-component': 'ArrayItems.Addition'
            }
          }

          currentValue['x-decorator'] = 'FormItem'
          currentValue['x-component'] = 'ArrayItems'
          currentValue['type'] = 'array'

          // NOTE since this has 'type: object' but using the array component
          // return is needed here to avoid assigning ComponentMap['object'] to x-component
          return currentValue
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
          } else if (currentValue.const) {
            if (name[0] == "$") {  // internal properties like $toscatype
              currentValue['x-hidden'] = true;
            } else {
              currentValue['x-read-only'] = true;
            }
          }
        }

        if(currentValue.input_type) {
          componentType = currentValue.input_type
        }

        currentValue['x-component'] = ComponentMap[componentType]
        return currentValue;
      });
    },

    updateFieldValidation(path, status) {
      if(!path) return
      this.setInputValidStatus({card: this.card, path, status})
    },

    triggerSave(field, value, disregardUncommitted) {
      const propertyName = field.name
      // debounce each property of a form separately in for autocomplete
      let triggerFn
      if(!(triggerFn = this.saveTriggers[propertyName])) {
        this.saveTriggers[propertyName] = triggerFn = _.debounce((function(field, value, disregardUncommitted=false) {
          let schemaDefinition
          try {
            schemaDefinition = this.schema.properties[field.name]
          } catch(e) {
            console.warn(`Couldn't look up schema definition for ${field.name}`)
          }

          // TODO move cloneDeep/serializer into another function
          let propertyValue = _.cloneDeepWith(value, function(value) {
            if(Array.isArray(value)) {
              if (value.length == 0) {
                return null
              }
              if (value.some(o => o?.input !== undefined)) {
                // I'm guessing we want to fall back on 'o' in case it's a new value, but this seems fragile
                return value.map(o => o?.input ?? o)
              } else if (value.some(o => o?.key !== undefined)) {
                const result = {}
                const defaultValue = schemaDefinition?.additionalProperties?.type == 'string'? '': undefined
                for(const entry of value)  {
                  result[entry.key] = entry.value ?? defaultValue
                }
                return result
              }
            }
          })

          if(_.isEqual(propertyValue, [{}]) && schemaDefinition?.additionalProperties) {
            propertyValue = {}
          }


          const propertyPath = [...this.propertyPath]
          let propertyName = field.name

          if(propertyName == '$additionalProperties') {
            const values = {...this.form.values}

            delete values.$toscatype
            delete values.$additionalProperties

            propertyName = propertyPath.pop()

            propertyValue = {...propertyValue, ...values}
          }

          this.updateProperty({deploymentName: this.$route.params.slug, templateName: this.card.name, propertyName, propertyValue, propertyPath})
          if(disregardUncommitted && !this.card._uncommitted) this.clientDisregardUncommitted()

        }).bind(this), 200)
      }

      triggerFn(field, value, disregardUncommitted)
    },

    cloneInner(next, value) {
      if(Array.isArray(value) && value.length > 0 && !next.isMap) {
        return value.map(input => ({input}))
      }

      if(value?.get_env) {
          return this.lookupEnvironmentVariable(value.get_env) || ''
      }

      const resolvedDirective = tryResolveDirective(value)
      if(resolvedDirective) {
        next.dirty = true

        if(resolverName(value) == '_generate') {
          return ''
        }

        return resolvedDirective
      }
    },

    getMainInputs() {
      const result = []

      const properties = this.card.properties || []

      for (const [name, definition] of Object.entries(this.schemaFields)) {
        try {
          if(definition.sensitive && !this.userCanEdit) continue
          if(definition.tab_title && !this.isNested) continue
          if(name == '$toscatype') continue

          const fullPropertyPath = [...this.propertyPath, name]
          const firstComponent = fullPropertyPath.shift()

          let firstComponentProperty
          let property = firstComponentProperty = properties.find(prop => prop.name == firstComponent)?.value

          for(const component of fullPropertyPath) {
            property = (property || {})[component]
          }

          if(name == '$additionalProperties') {
            let baseProp = firstComponentProperty
            for(const component of this.propertyPath.slice(1)) {
              baseProp = baseProp[component]
            }

            baseProp = {...baseProp}

            for(const field of Object.keys(this.schemaFields)) {
              delete baseProp[field]
            }

            property = baseProp
          }

          property = {fullPropertyPath: [...this.propertyPath, name], value: property, name, definition}

          const next = {...property, ...definition}

          if(next.isMap = next.additionalProperties && _.isObject(next.value)) {
            next.value = Object.entries(next.value).map(([key, value]) => ({key, value}))
          }

          const cloneInner = this.cloneInner.bind(this, next)

          next.value = _.cloneDeepWith(next.value, cloneInner)
          next.default = _.cloneDeepWith(next.default, cloneInner)

          result.push(next)
        } catch (e) {
          console.error(e)
        }
      }

      let len = 0
      for(const item of result) {
        if(item.name == '$additionalProperties') {
          len += item.value.length
        } else {
          len += 1
        }
      }

      this.$emit('setInputLength', len)
      return result
    }
  },
  async mounted() {
    const {createForm, onFieldInputValueChange} = await import("@formily/core")
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
        this.triggerSave(input, input.value ?? input.initialValue, true)
      }
    }
    const container = this.$refs.container

    form.onMount = async () => {
      // we have to wait for the components to exist for formily to validate?
      await fields()
      await Vue.nextTick()
      // we're somehow now always getting the element here
      container.$el?.querySelectorAll('.formily-element-form-item-extra').forEach(el => el.innerHTML = parseMarkdown(el.textContent))
      this.validate()
    }
  }
}
</script>
<template>
<component :is="wrapper" ref="container" v-if="!card.properties.length == 0" class="oc-inputs" data-testid="oc_inputs">
  <component :is="tabTooltip" v-if="tabTooltip" />
  <!-- TODO display description here as well -->
  <gl-tabs v-if="Object.keys(tabTitles).length > 0">
    <oc-tab title="Properties" @click="currentTabTitle = null"/>
    <oc-tab v-for="title in Object.keys(tabTitles)" :key="title" :title="title" @click="currentTabTitle = title"/>
  </gl-tabs>
  <FormProvider v-if="form" v-show="displayForm" :form="form">
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

  <div v-for="title in Object.keys(tabTitles)" :key="title" >
    <oc-inputs v-if="currentTabTitle == title" :card="card" :property-path="[...propertyPath, tabTitles[title]]" wrapper="div"/>
  </div>
</component>
</template>
<style scoped>
.oc-inputs >>> .formily-element-array-items-card {
  border: unset;
  background: unset;
}
.gl-dark >>> input::placeholder {
    opacity: 0.7;
}
.oc-inputs {
  max-width: max(100%, 800px);
  overflow: hidden;
}

.formily-element-form-default {
  display: inline-flex;
  flex-direction: column;
}

.formily-element-form-default >>> :not([role="tooltip"], [role="button"]) {
}

.formily-element-form-default >>> [class^="formily-element-form-item"] {
  display: inline-flex !important;
  justify-content: space-between;
  flex-wrap: wrap;
}

.oc-inputs >>> .formily-element-form-item-label {
  flex-basis: fit-content;
}


.oc-inputs >>> .formily-element-form-item-control {
  flex-basis: content;
  flex-grow: 0;
}

.oc-inputs >>> .formily-element-form-item-label-content {
  /* required asterisk after label */
  display: flex;
  flex-direction: row-reverse;
}

.oc-inputs >>> .formily-element-form-item-asterisk {
  /* required asterisk after label */
  margin: 0 0 0 4px;
}

.gl-dark >>> .formily-element-form-item-label-content > label {
  color: white;
}

.gl-dark >>> .formily-element-form-item-colon {
  color: white;
}

.oc-inputs >>> .formily-element-form-item-control-content { justify-content: flex-end; }
.oc-inputs >>> .formily-element-form-item-extra {
  left: calc(100% - 350px);
  position: absolute;
  font-size: 0.8em;
  line-height: 1.1;
  max-height: 2.2em;
  overflow: hidden;
  margin-top: 0.1em;
  bottom: 0;
}

.oc-inputs >>> .formily-element-form-item-control-content-component {
  width: 350px !important;
  max-width: 350px;
}

.oc-inputs>>> .formily-element-array-items-card {
  padding: 0;
}

.oc-inputs >>> .formily-element-array-base-addition {
  margin-bottom: 8px;
}

.oc-inputs >>> .formily-element-form-item-addon-after {
  margin-bottom: 8px;
}

.oc-inputs >>> .formily-element-form-item-control-content-component > :not(.formily-element-array-base-remove) {
  width: 100%;
}

.oc-inputs >>> .el-card__body {
  overflow: hidden;
}

.oc-inputs >>> .gl-dark
    :is(
      .formily-element-array-items-card .formily-element-form-item:not(.formily-element-form-item-feedback-layout-popover) .formily-element-form-item-help,
      .formily-element-array-items .formily-element-array-base-addition:is(:hover, :focus) /*TODO change this value for element-ui so it's not #FFFFFF (and then delete this selector)*/
    )
  {
  background-color: #DDDDDD
}

@media only screen and (min-width: 430px) {
    .oc-inputs >>> .oc-input-number .formily-element-form-item-control-content-component {
      width: 150px !important;
      max-width: 150px;
      margin-right: 200px;
    }
}

.oc-inputs >>> .formily-element-form-item {
  font-size: 1rem !important;
  position: relative;
  padding-bottom: 1.6em;
  margin-bottom: 1em;
}
.oc-inputs >>> .formily-element-form-item-control .formily-element-form-item-control-content .formily-element-form-item-addon-after {
  margin-left: 0;
}

/* hide the colon */
.oc-inputs >>> .formily-element-form-item-colon {
  opacity: 0;
}
</style>
