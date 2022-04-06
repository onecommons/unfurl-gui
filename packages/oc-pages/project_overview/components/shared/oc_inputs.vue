<script>
import _ from 'lodash';
import {bus} from '../../bus';
import {__} from '~/locale';
import {mapActions, mapMutations, mapGetters} from 'vuex'
import {FormProvider, createSchemaField} from "@formily/vue";
import {FormItem, Input, InputNumber, Checkbox, Select, Password, Editable} from "@formily/element";
import {createForm, onFieldInputValueChange} from "@formily/core";

const ComponentMap = {
  string: 'Input',
  boolean: 'Checkbox',
  number: 'InputNumber',
  enum: 'Select',
  object: 'Editable.Popover',
  password: 'Password',
};

const SerializationFunctions = {
  number(input, value) {
    const result = parseInt(value)
    if(!isNaN(result)) return result
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
  },

  data() {
    return {
      form: null
    }
  },
  computed: {
    ...mapGetters(['resolveResourceType', 'cardInputsAreValid']),

    fromSchema() {
      return this.resolveResourceType(this.card.type)?.inputsSchema?.properties || {}
    },

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
          await this.form.fields[key].validate()
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
        currentValue['x-data'] = value
        currentValue['x-component-props'] = {
          placeholder: currentValue.title
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

    updateFieldValidation(field, status) {
      this.setCardInputValidStatus({card: this.card, status})
    },

    triggerSave: _.debounce(function preview(field, value) {
      const propertyValue = serializeInput(field, value)
      this.updateProperty({deploymentName: this.$route.params.slug, templateName: this.card.name, propertyName: field.name, propertyValue, isSensitive: field.sensitive})
    }, 200),

    getRandomKey(length) {
      return Math.random().toString(36).replace(/[^a-z][0-9]+/g, '').substr(0, length);
    }
  },
  mounted() {
    const form = createForm({
      initialValues: this.initialFormValues,
      effects: () => {
        onFieldInputValueChange('*', async (field, ...args) => {
          // I'm not sure this would work for autocomplete if we did on validate
          // on the other hand if we check valid here, I'm not sure whether it's updated or not yet
          // if(form.valid) this.triggerSave({...field.data, name: field.path.entire}, field.value);
          this.validate()
          this.triggerSave({...field.data, name: field.path.entire}, field.value);
        })
      }
    })
    this.form = form
    this.validate()
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
        <FormProvider v-if="form" :form="form">
          <SchemaField :schema="schema"/>
        </FormProvider>
  </div>
</template>
