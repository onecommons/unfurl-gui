<template>
  <div class="container">
    <div class="json-editor">
      <gl-form-textarea
          :value="sourceSchema"
          placeholder="source-json-schema"
      />
      <gl-button
          category="primary"
          variant="default"
          size="medium"
          @click="convert"
      >
        Convert
      </gl-button>
    </div>
    <div>
      <FormProvider :form="form" style="height: 100vh">
        <SchemaField :schema="schema"/>
        <span style="display: flex;justify-content: center">
    <Submit @submit="onSubmit">submit</Submit>
   </span>
      </FormProvider>
    </div>
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
import {GlButton, GlFormTextarea, GlToast} from "@gitlab/ui";

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

const form = createForm({})
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

const ComponentMap = {
  string: 'Input',// ? password/select/
  boolean: 'Checkbox', // ?? 怎么区分Checkbox/Radio/
  number: 'InputNumber',
  enum: 'Select',
  object: 'Editable.Popover',
  password: 'Password',
};


export default {
  components: {
    FormProvider, ...fields, Submit,
    GlButton,
    GlFormTextarea,
  },

  data() {
    return {
      form,
      schema,
      sourceSchema: '\n' +
          '{\n' +
          '  "type": "object",\n' +
          '  "properties": {\n' +
          '  "checkboxField": {\n' +
          '    "type": "boolean"\n' +
          '  },\n' +
          '  "selectField": {\n' +
          '    "type": "string",\n' +
          '      "enum": ["A", "B", "C"]\n' +
          '  },\n' +
          '  "defaultValueField": {\n' +
          '    "type": "string",\n' +
          '      "default": "defaultValue"\n' +
          '  },\n' +
          '  "numberInputField": {\n' +
          '    "type": "number"\n' +
          '  },\n' +
          '  "readonlyField": {\n' +
          '    "const": "readonly"\n' +
          '  },\n' +
          '  "hiddenField": {\n' +
          '    "const": null\n' +
          '  },\n' +
          '  "sensitiveField": {\n' +
          '    "type": "string",\n' +
          '      "sensitive": true\n' +
          '  },\n' +
          '  "recursiveField": {\n' +
          '    "type": "object",\n' +
          '      "properties": {\n' +
          '      "nestedField": {\n' +
          '        "type": "string"\n' +
          '      },\n' +
          '      "test": {\n' +
          '        "type": "string"\n' +
          '      }\n' +
          '    }\n' +
          '  }\n' +
          '}\n' +
          '}'
    }
  },
  methods: {
    onSubmit(value) {
      // handle form values
      console.log(value);
    },
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
    convert() {
      const source = JSON.parse(this.sourceSchema);
      const formilyJSON = {};
      if (source.type !== 'object' && !source.properties) {
        return;
      }
      formilyJSON.type = 'object';
      const properties = source.properties;
      formilyJSON.properties = this.convertProperties(properties);
      this.schema = formilyJSON;
    },

  }
};
</script>

<style scoped type="less">
.container {
  display: flex;
  height: 100VH;
  width: 100%;
}

.json-editor {
  width: 50%;
  margin-right: 50px;
}

.gl-form-textarea {
  height: 100%;
}
</style>
