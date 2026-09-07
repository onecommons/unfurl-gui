
// #!if !standalone
import LocalImageRepoSource from './LocalImageRepoSource.vue'
import GithubMirroredRepoImageSource from './GithubMirroredRepoImageSource.vue'
import UnfurlCloudMirroredRepoImageSource from './UnfurlCloudMirroredRepoImageSource.vue'
import UnfurlCNamedDNSZone from './UnfurlCNamedDNSZone.vue'
// #!endif

import {parseMarkdown} from 'oc_vue_shared/client_utils/markdown'

import EnvironmentTooltip from './tooltips/EnvironmentTooltip.vue'

import GenerateDirective from './directives/GenerateDirective.vue'

const customComponents = {

    // #!if !standalone
    GithubMirroredRepoImageSource,
    LocalImageRepoSource,
    UnfurlCloudMirroredRepoImageSource,
    UnfurlCNamedDNSZone
    // #!endif

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

// #!if !standalone
import FileSelector from './formily-file-selector'
// #!endif

const formilyGl = async function() {
    if(!formilyGl.promise) {
        formilyGl.promise = import('./formily-gl').then(module => {
            // descriptions are markdown; FormItem renders them through this
            module.registerExtraRenderer(text => parseMarkdown(text))
            return module
        })
    }
    const {FormLayout, FormItem, ArrayItems, Input, InputNumber, Checkbox, Select, Editable, Space} = await formilyGl.promise
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
        formilyGl(),
    ])

    const {createSchemaField} = _formilyVue
    const {FormItem, ArrayItems, Input, InputNumber, Checkbox, Select, Editable, Space} = _formilyElement

    return createSchemaField({
      components: {
        FormItem,
        ArrayItems,
        Space,
        Input,
        InputNumber, Checkbox, Select, FakePassword, Editable,

        // #!if !standalone
        FileSelector
        // #!endif

      }
    })
}


export const FormProvider = async() => (await formilyVue()).FormProvider
export const FormLayout = async() => (await formilyGl()).FormLayout

export const schemaFieldComponents = {}
for(const schemaFieldComponentName of ['SchemaField', 'FormItem', 'ArrayItems', 'Input', 'InputNumber', 'Checkbox', 'Select', 'Editable', 'Space']) {
    schemaFieldComponents[schemaFieldComponentName] = async() => (await fields())[schemaFieldComponentName]
}
