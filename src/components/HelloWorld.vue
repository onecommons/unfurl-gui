<template>
  <div class="hello">
    <h2>Unfurl.cloud Pages:</h2>
    <div class="d-flex flex-column">
      Projects
      <projects-list />
    </div>
    <!--p>
    <a href="/testing/apostrophe-demo/-/overview">Project Overview</a> <br>(Copy of <code>gitlab-oc/oc/app/assets/javascripts/pages/projects/overview/</code>)
  </p-->
  <p>
    <a href="/dashboard">Dashboard</a> <br>(Copy of <code>gitlab-oc/oc/app/assets/javascripts/pages/dashboard</code>)
  </p>
  <!--p>
    <a href="/form">Formily Testbed</a> 
  </p-->
  <!--hr> 
  <p>
    For a guide and recipes on how to configure / customize this project,<br />
    check out the
    <a href="https://cli.vuejs.org" target="_blank" rel="noopener"
    >vue-cli documentation</a
  >.
  </p-->
  <!--h3>Installed CLI Plugins</h3-->
  <!--ul>
    <li>
      <a
        href="https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-plugin-babel"
        target="_blank"
        rel="noopener"
      >babel</a
    >
    </li>
    <li>
      <a
        href="https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-plugin-eslint"
        target="_blank"
        rel="noopener"
      >eslint</a
    >
    </li>
  </ul-->
  <h3>Essential Links</h3>
  <ul>
    <li>
      <a href="https://vuejs.org" target="_blank" rel="noopener">Core Docs</a>
    </li>
    <li>
      <a href="https://forum.vuejs.org" target="_blank" rel="noopener"
      >Forum</a
    >
    </li>
    <li>
      <a href="https://chat.vuejs.org" target="_blank" rel="noopener"
      >Community Chat</a
    >
    </li>
    <li>
      <a href="https://twitter.com/vuejs" target="_blank" rel="noopener"
      >Twitter</a
    >
    </li>
    <li>
      <a href="https://news.vuejs.org" target="_blank" rel="noopener">News</a>
    </li>
  </ul>
  <h3>Ecosystem</h3>
  <ul>
    <li>
      <a href="https://router.vuejs.org" target="_blank" rel="noopener"
      >vue-router</a
    >
    </li>
    <li>
      <a href="https://vuex.vuejs.org" target="_blank" rel="noopener">vuex</a>
    </li>
    <li>
      <a
        href="https://github.com/vuejs/vue-devtools#vue-devtools"
        target="_blank"
        rel="noopener"
      >vue-devtools</a
    >
    </li>
    <li>
      <a href="https://vue-loader.vuejs.org" target="_blank" rel="noopener"
      >vue-loader</a
    >
    </li>
    <li>
      <a
        href="https://github.com/vuejs/awesome-vue"
        target="_blank"
        rel="noopener"
      >awesome-vue</a
    >
    </li>
  </ul>
  <!--FormProvider :form="form" style="height: 100vh">
    <SchemaField :schema="schema"/>
    <span style="display: flex;justify-content: center">
      <Submit @submit="onSubmit">submit</Submit>
    </span>
  </FormProvider-->
</div>
</template>

<script>
import ProjectsList from './HelloWorld/projects-list.vue'
/*
import {createForm,setValidateLanguage} from "@formily/core";
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
  Space
} from "@formily/element";
 */

/*
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

const form = createForm()
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
    ArrayItems
  },
})
*/
export default {
  components: {
    //FormProvider, 
    //...fields, 
    //Submit, 
    ProjectsList
  },
  data() {
    return {
      //form,
      //schema
    }
  },
  methods: {
    onSubmit(value) {
      console.log(value);
    }
  }
};
</script>

<style scoped>

</style>
