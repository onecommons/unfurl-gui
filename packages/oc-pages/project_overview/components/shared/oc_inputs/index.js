import LocalImageRepoSource from './LocalImageRepoSource.vue'
import GithubMirroredRepoImageSource from './GithubMirroredRepoImageSource.vue'
import UnfurlCloudMirroredRepoImageSource from './UnfurlCloudMirroredRepoImageSource.vue'
import UnfurlCNamedDNSZone from './UnfurlCNamedDNSZone.vue'

import EnvironmentTooltip from './tooltips/EnvironmentTooltip.vue'

import GenerateDirective from './directives/GenerateDirective.vue'

const customComponents = {
    GithubMirroredRepoImageSource,
    LocalImageRepoSource,
    UnfurlCloudMirroredRepoImageSource,
    UnfurlCNamedDNSZone
}

const customTooltips = {
    'environment': EnvironmentTooltip,
}

const uiDirectives = {
    'generate': GenerateDirective,
}

export function getCustomInputComponent(type) {
    return customComponents[type] ?? null
}

export function getCustomTooltip(type) {
    return customTooltips[type] ?? null
}

export function getUiDirective(type) {
    return uiDirectives[type] ?? null
}

import FakePassword from './formily-fake-password'
import FileSelector from './formily-file-selector'

const formilyElement = async function() {
    if(!formilyElement.promise) {
        formilyElement.promise = import('@formily/element')
    }
    const {FormLayout, FormItem, ArrayItems, Input, InputNumber, Checkbox, Select, Editable, Space} = await formilyElement.promise
    return {FormLayout, FormItem, ArrayItems, Input, InputNumber, Checkbox, Select, Editable, Space}
}

const formilyVue = async function() {
    if(!formilyVue.promise) {
        formilyVue.promise = import('@formily/vue')
    }
    const {FormProvider, createSchemaField} = await formilyVue.promise
    return {FormProvider, createSchemaField}
}

export const fields =  async function() {
    const [_formilyVue, _formilyElement] = await Promise.all([
        formilyVue(),
        formilyElement(),
    ])

    const {createSchemaField} = _formilyVue
    const {FormItem, ArrayItems, Input, InputNumber, Checkbox, Select, Editable, Space} = _formilyElement

    return createSchemaField({
      components: {
        FormItem,
        ArrayItems,
        Space,
        Input,
        InputNumber, Checkbox, Select, FakePassword, FileSelector, Editable
      }
    })
}


export const FormProvider = async() => (await formilyVue()).FormProvider
export const FormLayout = async() => (await formilyElement()).FormLayout

export const schemaFieldComponents = {}
for(const schemaFieldComponentName of ['SchemaField', 'FormItem', 'ArrayItems', 'Input', 'InputNumber', 'Checkbox', 'Select', 'Editable', 'Space']) {
    schemaFieldComponents[schemaFieldComponentName] = async() => (await fields())[schemaFieldComponentName]
}
