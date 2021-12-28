<template>
  <div class="hello">
    <FormProvider :form="form" style="height: 100vh">
      <SchemaField :schema="schema"/>
      <span style="display: flex;justify-content: center">
    <Submit @submit="onSubmit">submit</Submit>
   </span>
    </FormProvider>
  </div>
</template>

<script>
import {createForm, setValidateLanguage} from "@formily/core";
import {createSchemaField, FormProvider} from "@formily/vue";
import {
  FormItem,
  FormLayout,
  Input,
  Select,
  Submit,
  Checkbox,
  Radio,
  InputNumber,
  Password,
  ArrayItems,
  Editable,
  Space
} from "@formily/element";

setValidateLanguage('en-US');

const schema = {
  type: 'object',
  properties: {
    layout: {
      type: 'void',
      'x-component': 'FormLayout',
      'x-component-props': {
        labelCol: 4,
        wrapperCol: 20,
      },
      properties: {
        confirm: {
          type: 'boolean',
          title: 'confirm',
          'x-decorator': 'FormItem',
          'x-component': 'Checkbox',
        },
        checkbox: {
          type: 'array',
          title: 'checkbox',
          'x-decorator': 'FormItem',
          'x-component': 'Checkbox.Group',
          enum: [
            {label: 'OptionA', value: 'A'},
            {label: 'OptionB', value: 'B'},
            {label: 'OptionC', value: 'C'},
            {label: 'OptionD', value: 'D'},
          ]
        },
        radio: {
          type: 'boolean',
          title: 'radio',
          enum: [
            {label: 'OptionA', value: 'A'},
            {label: 'OptionB', value: 'B'},
            {label: 'OptionC', value: 'C'},
          ],
          'x-decorator': 'FormItem',
          'x-component': 'Radio.Group',
        },
        select: {
          type: 'string',
          title: 'select',
          required: true,
          'x-decorator': 'FormItem',
          'x-component': 'Select',
          enum: [
            {label: 'OptionA', value: 'A'},
            {label: 'OptionB', value: 'B'},
          ]
        },
        input: {
          type: 'string',
          title: 'input',
          required: true,
          'x-decorator': 'FormItem',
          'x-decorator-props': {
            tooltip: '123',
          },
          'x-component': 'Input',
        },
        defaultInput: {
          type: 'string',
          title: 'default',
          required: true,
          default: 'default',
          'x-decorator': 'FormItem',
          'x-component': 'Input',

        },
        number: {
          type: 'number',
          title: 'number',
          'x-decorator': 'FormItem',
          'x-component': 'InputNumber',
        },
        readOnly: {
          type: 'string',
          title: 'readOnly',
          required: true,
          default: 'default',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-read-only': true,
        },
        hidden: {
          type: 'string',
          title: 'hidden',
          required: true,
          default: 'default',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-hidden': 'true,'
        },
        sensitive: {
          type: 'string',
          title: 'password',
          'x-decorator': 'FormItem',
          'x-component': 'Password',
        },
        config: {
          type: 'object',
          title: 'config',
          'x-component': 'Editable.Popover',
          'x-component-props': {
            title: 'detail',
          },
          'x-decorator': 'FormItem',
          properties: {
            layout: {
              type: 'void',
              'x-component': 'FormLayout',
              'x-component-props': {
                labelCol: 10,
                wrapperCol: 14,
              },
              properties: {
                id: {
                  type: 'string',
                  title: 'ID',
                  required: true,
                  'x-decorator': 'FormItem',
                  'x-component': 'Input',
                },
                name: {
                  type: 'Name',
                  title: 'input',
                  required: true,
                  'x-decorator': 'FormItem',
                  'x-component': 'Input',
                },
                describe: {
                  type: 'string',
                  title: 'Describe',
                  required: true,
                  'x-decorator': 'FormItem',
                  'x-component': 'Input',
                }
              }
            }
          }
        },
        recursive: {
          type: 'array',
          'x-component': 'ArrayItems',
          'x-decorator': 'FormItem',
          title: 'Recursive',
          items: {
            type: 'object',
            properties: {
              space: {
                type: 'void',
                'x-component': 'Space',
                properties: {
                  sort: {
                    type: 'void',
                    'x-decorator': 'FormItem',
                    'x-component': 'ArrayItems.SortHandle',
                  },
                  input: {
                    type: 'string',
                    title: 'input',
                    'x-decorator': 'FormItem',
                    'x-component': 'Input',
                  },
                  select: {
                    type: 'string',
                    title: 'select',
                    enum: [
                      {label: 'select1', value: 1},
                      {label: 'select2', value: 2},
                    ],
                    'x-decorator': 'FormItem',
                    'x-component': 'Select',
                    'x-component-props': {
                      style: {
                        width: '250px',
                      },
                    },
                  },
                  remove: {
                    type: 'void',
                    'x-decorator': 'FormItem',
                    'x-component': 'ArrayItems.Remove',
                  },
                }
              }
            }
          },
          properties: {
            add: {
              type: 'void',
              title: 'add items',
              'x-component': 'ArrayItems.Addition',
            },
          },
        }
      }
    }
  }
}

const form = createForm({
      initialValues: {
        confirm: true,
        checkbox: ['A', 'C'],
        config: {
          id: 'test',
          name: 'test',
          describe: 'test'
        },
        recursive: [
          {input: 'test', select: 1}
        ]
      } // set form's values
    }
)
const fields = createSchemaField({
  components: {
    FormLayout,
    FormItem,
    Input,
    Select,
    Checkbox,
    Radio,
    InputNumber,
    Password,
    Space,
    ArrayItems,
    Editable
  },
})
export default {
  components: {FormProvider, ...fields, Submit},
  data() {
    return {
      form,
      schema
    }
  },
  methods: {
    onSubmit(value) {
      // handle form values
      console.log(value);
    }
  }
};
</script>

<style scoped>

</style>
