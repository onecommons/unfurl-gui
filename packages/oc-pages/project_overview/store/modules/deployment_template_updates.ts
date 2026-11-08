import _ from 'lodash'
import type {ActionContext, Module} from '@gitlab/vuex-vue3'
import {slugify, lookupCloudProviderAlias} from 'oc_vue_shared/util'
import {patchEnv} from 'oc_vue_shared/client_utils/envvars'
import {fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import {fetchUserAccessToken} from 'oc_vue_shared/client_utils/user'
import {unfurl_cloud_vars_url} from 'oc_vue_shared/client_utils/unfurl-invocations'
import {declareAvailableProviders} from "../../../vue_shared/client_utils/environments";
import {unfurlServerUpdate} from "../../../vue_shared/client_utils/unfurl-server";
import { getOrFetchCurrentBranch, createBranch } from "../../../vue_shared/client_utils/projects";
import {freeze} from 'oc_vue_shared/client_utils/misc'

export const UPDATE_TYPE = {
    deployment: 'deployment', DEPLOYMENT: 'deployment',
    blueprint: 'blueprint', BLUEPRINT: 'blueprint',
    environment: 'environment', ENVIRONMENT: 'environment',
    deleteDeployment: 'delete-deployment', DELETE_DEPLOYMENT: 'delete-deployment', 'delete-deployment': 'delete-deployment',
    deleteEnvironment: 'delete-environment', DELETE_ENVIRONMENT: 'delete-environment', 'delete-environment': 'delete-environment'
}

const SECRET_DIRECTIVE = "get_env"
const UNDERSCORE_PREFIX_WHITELIST = ['__typename', '_sourceinfo']

// The unfurl export JSON; typed loosely until the payload types exist.
type Json = Record<string, any>

// What prepared mutations read and write: the records being edited, by
// typename (ResourceTemplate, DeploymentTemplate, ...) and then name.
export type Accumulator = Record<string, Record<string, any>>

// One record to write; a null patch deletes it.
export interface PatchDefinition {
    typename: string
    target: string
    patch: Json | null
    env?: Record<string, unknown>
}

// Run against the accumulator when committing; may return further builders.
export type PreparedMutation = (accumulator: Accumulator) => (PatchDefinition | PreparedMutation)[]

// An input schema, as in a type's inputsSchema
interface Schema {
    type?: string
    properties?: Record<string, Schema>
    sensitive?: boolean
    required?: boolean
    [key: string]: unknown
}

const visitMutation = (_name: string) => {}
// const visitMutation = console.log

/*
 * this module is used to prepare a set of patches and push them to correct path using updateDeploymentObj
 * the shape of areguments passed to updateDeploymentObj changed after this module was created, so there are unnecessary transformations and an internal representation of patches that doesn't make much sense

 * this module also handles posting environment variables for sensitive inputs and cleaning up state before it's committed
 * some of the normalizations done prior to committing are done to prevent errors in unfurl

 * there are some exported functions that are expected to be used in combination with pushPreparedMutation
 * some of these exported functions have more complex behavior for keeping things consistent [1]
 * the behavior for these is a bit unusual and if you need to directly commit an object, I'd committing pushPreparedMutation like this:
          this.pushPreparedMutation(() => {
             return [{
               typename: 'DeploymentPath',
               patch: {__typename: 'DeploymentPath', environment},
               target: this.deploymentDir
             }]


 * some concepts like committedNames and fetchRoot are inconsistent between targets (i.e. deployment.json vs environments.json)
 * this is pretty ugly and what I'd consider refactoring first


 * [1] calls mutating resource templates such as updatePropertyInResourceTemplate, move templates from .DeploymentTemplate[<template>].ResourceTemplate to .ResourceTemplate
*/

function convertFieldToDictionaryIfNeeded(node: Json, field: string) {
    if(Array.isArray(node[field])) {
        const result: Json = {}
        for(const el of node[field]) {
            if(el.name) {
                result[el.name] = el
            }
        }
        node[field] = result
    } else if(typeof node[field] == 'object') {
        // pass
    } else {
        node[field] = {}
    }
}

function fieldsToDictionary(node: Json, ...fields: string[]) {
    for(const field of fields) {
        convertFieldToDictionaryIfNeeded(node, field)
    }
}

function allowFields(node: Json, ...fields: string[]) {
    for(const field in node) {
        if(field == 'name' || UNDERSCORE_PREFIX_WHITELIST.includes(field)) continue
        if(!fields.includes(field)) {
            node[field] = undefined
        }
    }
}

function excludePrefixedFields(node: Json) {
    for(const field in node) {
        if(field.startsWith('_') && !UNDERSCORE_PREFIX_WHITELIST.includes(field)) {
            try {
                // TODO this can fail if our node is frozen
                delete node[field]
            } catch(e) { console.error(`@excludePrefixedFields: ${(e as Error).message}`) }
        }
    }
}

// Replaces a sensitive value in props with a reference to an environment
// variable, and returns the variables to write (or destroy).
function normalizeUpdatedProperties(name: string, schema: Schema | undefined, props: Json, envvarPrefix: string, pathComponents: string[] = [], env: Record<string, unknown> = {}) {
    const _pathComponents = pathComponents.concat([name])
    if(name == '$toscatype') return

    if(!schema) {
        return
    }
    // this doesn't currently account for additional properties
    if(schema.type == 'object' && schema.properties) {
        const innerProps = props[name]
        Object.entries(schema.properties).forEach(([name, schema]) => {
            normalizeUpdatedProperties(name, schema, innerProps, envvarPrefix, _pathComponents, env)
        })
    } else {
        const envKey = (schema.sensitive && `${envvarPrefix}__${_pathComponents.join('_')}`.replace(/-/g, '_')) as string
        let value = props[name]

        // allow 0 and empty strings unless the input is required
        if(schema.required && value === '') value = null
        if((value ?? null) !== null) {
            if(schema.sensitive && !value[SECRET_DIRECTIVE]) {
                env[envKey] = value
                props[name] = {[SECRET_DIRECTIVE]: envKey}
            }
        } else {
            if(schema.sensitive) {
                // delete the environment variable
                env[envKey] = {_destroy: true}

                // to not clean up -
                // delete env[envKey]
            }

            if(pathComponents.length == 0) {
                // at top level we should do this instead
                props[name] = {__deleted: true}
            } else {
                delete props[name]
            }
        }
    }

    return env
}


// Clean a patch for committing, per typename; '*' runs on every one.
const Serializers: Record<string, (record: Json, state: Json) => Json[] | void> = {
    DeploymentEnvironment(env, state) {
        allowFields(env, 'connections', 'instances', 'external', 'repositories')
        fieldsToDictionary(env, 'connections', 'instances')

        if(env.instances.primary_provider) {
            env.connections.primary_provider = env.instances.primary_provider
            delete env.instances.primary_provider
        }

        for(const [name, instance] of Object.entries(env.instances as Record<string, Json>)) {
            if(lookupCloudProviderAlias(instance?.type)) {
                env.connections[name] = env.instances[name]
                delete env.instances[name]
            }

            if(env.name != 'defaults' && state.DeploymentEnvironment?.defaults?.instances?.hasOwnProperty(name)) {
                delete env.instances[name]
            }
        }

        return (Object.values(env.instances || {}) as Json[]).concat(Object.values(env.connections))
    },
    DeploymentTemplate(dt, state) {
        if(state.ResourceTemplate) {
            const localResourceTemplates = dt?.ResourceTemplate
            if(localResourceTemplates) {
                for(const rt of Object.keys(localResourceTemplates)) {
                    // TODO check that we haven't modified a local resource template that hasn't been edited by the user
                    Serializers.ResourceTemplate(localResourceTemplates[rt], state)
                }
            }

            dt.resourceTemplates = _.union(Object.keys(localResourceTemplates || {}), Object.keys(state.ResourceTemplate || {}))
        }
        if(dt.source == '__generated') {
            dt.directives = ['predefined'] // mark as not needing to be committed
        }
    },
    // TODO unit test
    ResourceTemplate(rt, state) {
        if(rt.__typename == 'Resource') return Serializers.Resource(rt, state)

        if(rt.directives?.includes('select')) {
            allowFields(rt, 'name', 'title', 'directives', 'imported', 'type', 'extends', 'metadata')
            return
        }

        excludePrefixedFields(rt)

        if(rt.visibility != 'hidden') {
            try {
                delete rt.visibility // do not commit template visibility
            } catch(e) {
                console.error(e) // seems to happen when visibility was already set?
            }
        } else {
            rt.metadata = rt.metadata || {}
            rt.metadata.visibility = 'hidden'
        }

        rt.dependencies = rt.dependencies?.filter((dep: Json) => {
            return dep.match || dep.target || dep.constraint.match
        })

        rt.properties = _.unionBy(rt.properties, rt.computedProperties, 'name')

        // This won't filter out any required properties because the user shouldn't be allowed
        // to deploy with null required values
        rt.properties = rt.properties?.filter((prop: Json) => {
            return (prop.value ?? null) !== null
        })

        // check deep
        // TODO unit test this function
        _.forOwn(rt.properties, (value) => {
            if(typeof value == 'object') {
                Object.entries(value as Json).forEach(([childKey, childValue]) => {
                    if((childValue ?? null) === null)
                        delete (value as Json)[childKey]
                })
            }
        })

        rt.dependencies?.forEach((dep: Json) => {
            excludePrefixedFields(dep)
            excludePrefixedFields(dep.constraint)

            if(! dep.constraint.visibility) {
                dep.constraint.visibility = 'visible' // ensure visibility is committed by the client
            }
        })

        if(rt.directives?.includes('substitute')) {
            rt.dependencies = rt.dependencies.filter(
                (dep: Json) => !(
                    rt.dependencies.some((otherDep: Json) => otherDep.name == dep.match) &&
                    !state.ResourceTemplate[dep.match]
                )
            )
        }
    },
    Resource(resource) {
        /*
        <template_name>:
           directives:
             - select
           imported: <DEPLOYMENTNAME>:<original_template_name>
           type: <type_name>
        */

        const newObject = {
            name: resource.name,
            extends: resource.extends,
            metadata: resource.metadata,
            title: resource.title,
            directives: ['select'],
            imported: `${resource._deployment}:${resource.template}`,
            type: resource._type?.name || resource._type, // somehow the full type entry ended up here?
            __typename: 'ResourceTemplate'
        }

        for(const key in resource) {
            if(resource.hasOwnProperty(key)) delete resource[key]
        }
        Object.assign(resource, newObject)
    },
    '*': function(any: Json) {
        excludePrefixedFields(any)
        freeze(any)
    }
}

export function updatePropertyInInstance({environmentName, templateName, propertyName, propertyValue, inputsSchema}: {
    environmentName: string
    templateName: string
    propertyName: string
    propertyValue: unknown
    inputsSchema: Schema
}): PreparedMutation {
    return function(accumulator) {
        visitMutation('updatePropertyInInstance')
        // let _propertyValue = _.cloneDeep(propertyValue)
        let _propertyValue = propertyValue // clone moved to caller
        const schemaFor = inputsSchema.properties![propertyName]
        const envvarPrefix = templateName

        const props: Json = {[propertyName]: _propertyValue}
        const env = normalizeUpdatedProperties(propertyName, schemaFor, props, envvarPrefix)
        _propertyValue = props[propertyName]

        const patch = accumulator['DeploymentEnvironment'][environmentName]

        if(!patch.instances) patch.instances = []

        let instance = Array.isArray(patch.instances) ?
            patch.instances.find((i: Json) => i.name == templateName) :
            patch.instances[templateName]

        if(!instance) {
            instance = Array.isArray(patch.connections) ?
                patch.connections.find((i: Json) => i.name == templateName) :
                patch.connections[templateName]
        }
        const property = instance.properties.find((p: Json) => p.name == (propertyName))
        if(property) {
            property.value = _propertyValue
        } else {
            instance.properties.push({name: propertyName, value: _propertyValue})
        }
        return [ {typename: 'DeploymentEnvironment', target: templateName, patch, env} ]
    }
}

// I'm not sure if _sourceinfo makes sense for an environment instance, but might as well pass it through
// the fields a new template is created from; anything else passes through
interface TemplateArgs {
    type: string | Json
    name: string
    title?: string
    description?: string
    dependencies?: Json[]
    dependentName?: string
    dependentRequirement?: string
    [key: string]: unknown
}

export function createEnvironmentInstance({type, name, title, description, dependencies, environmentName, dependentName, dependentRequirement, ...passthru}: TemplateArgs & {environmentName: string}): PreparedMutation {
    return function(accumulator) {
        visitMutation('createEnvironmentInstance')
        const resourceType = typeof(type) == 'string'? Object.values(accumulator['ResourceType']).find(rt => rt.name == type): type
        let properties: Json[]
        try {
            properties = Object.entries(resourceType.inputsSchema.properties || {}).map(([key, inProp]) => ({name: key, value: (inProp as Json).default ?? null}))
        } catch(e) { properties = [] }

        const template = {
            type: typeof(type) == 'string'? type: type.name,
            name,
            title,
            description,
            __typename: "ResourceTemplate",
            properties,
            ...passthru,
            dependencies: dependencies || []
        }

        const patch = accumulator['DeploymentEnvironment'][environmentName]

        if(! patch.instances) {
            patch.instances = {}
        }

        if(dependentName) {
            const dependent = patch.instances[dependentName]
            const dependency = dependent?.dependencies?.find((dep: Json) => dep.name == dependentRequirement)
            if(dependency) {
                dependency.match = template.name
            }
        }

        patch.instances[template.name] = template

        return [ {typename: 'DeploymentEnvironment', target: environmentName, patch} ]
    }
}

export function deleteEnvironmentInstance({templateName, environmentName, dependentName, dependentRequirement}: {
    templateName: string
    environmentName: string
    dependentName?: string
    dependentRequirement?: string
}): PreparedMutation {
    return function(accumulator) {
        visitMutation('deleteEnvironmentInstance')
        const patch = accumulator['DeploymentEnvironment'][environmentName]
        if(patch.instances[templateName]) {
            delete patch.instances[templateName]
            if(dependentName) {
                const dependent = patch.instances[dependentName]
                const dependency = dependent?.dependencies?.find((dep: Json) => dep.name == dependentRequirement)

                if(dependency) {
                    dependency.match = null
                }
            }
        } else {
            // assume we are attempting to delete a provider
            delete patch.connections[templateName]
        }

        return [ {typename: 'DeploymentEnvironment', target: environmentName, patch} ]
    }
}

// TODO refactor to share implementation with updatePropertyInInstance
interface UpdatePropertyArgs {
    templateName: string
    propertyName: string
    propertyValue: unknown
    deploymentName: string
    inputsSchema: Schema
}

export function updatePropertyInResourceTemplate(args: UpdatePropertyArgs): PreparedMutation {
    const {templateName, propertyName, propertyValue, deploymentName, inputsSchema} = args
    return function(accumulator) {
        visitMutation('updatePropertyInResourceTemplate')
        const deploymentTemplate = accumulator['DeploymentTemplate'][deploymentName]
        const result: (PatchDefinition | PreparedMutation)[] = []

        let _propertyValue = propertyValue // cloned at caller

        if(deploymentTemplate.ResourceTemplate && deploymentTemplate.ResourceTemplate[templateName]) {
            if(deploymentTemplate._sourceTemplate) {
                result.push(
                    deleteResourceTemplate({templateName, deploymentTemplateName: deploymentTemplate.name})
                )

                result.push(
                    {typename: 'ResourceTemplate', target: templateName, patch: {...deploymentTemplate.ResourceTemplate[templateName], _local: false}}
                )

                return [...result, updatePropertyInResourceTemplate(args)]
            }

            // It doesn't make sense to try to encrypt envvars here.
            // We shouldn't be hitting this code path outside of editing blueprints.
            const resourceTemplate = deploymentTemplate.ResourceTemplate[templateName]
            const property = resourceTemplate.properties.find((p: Json) => p.name == propertyName)
            property.value = _propertyValue
        } else {
            const schemaFor = inputsSchema.properties![propertyName]
            const envvarPrefix = `${deploymentName}__${templateName}`

            const props: Json = {[propertyName]: _propertyValue}
            const env = normalizeUpdatedProperties(propertyName, schemaFor, props, envvarPrefix)
            _propertyValue = props[propertyName]

            const patch = accumulator['ResourceTemplate'][templateName]
            const property = patch.properties.find((p: Json) => p.name == propertyName)
            property.value = _propertyValue

            result.push({typename: 'ResourceTemplate', target: templateName, patch, env})
        }

        return result
    }
}

export function appendResourceTemplateInDT({templateName, deploymentTemplateName}: {templateName: string, deploymentTemplateName: string}): PreparedMutation {
    return function(accumulator) {
        visitMutation('appendResourceTemplateInDT')
        const patch = accumulator['DeploymentTemplate'][deploymentTemplateName] || {}
        if(Array.isArray(patch.resourceTemplates)) patch.resourceTemplates.push(templateName)
        else patch.resourceTemplates = [templateName]
        return [ {typename: 'DeploymentTemplate', target: deploymentTemplateName, patch} ]
    }
}

export function deleteResourceTemplateInDT({templateName, deploymentTemplateName}: {templateName: string, deploymentTemplateName: string}): PreparedMutation {
    return function(accumulator) {
        visitMutation('deleteResourceTemplateInDT')
        const patch = accumulator['DeploymentTemplate'][deploymentTemplateName] || {}
        if(!patch.resourceTemplates)
            patch.resourceTemplates = []
        const index = patch.resourceTemplates.indexOf(templateName)
        if(index != -1) patch.resourceTemplates.splice(index, 1)
        return [ {typename: 'DeploymentTemplate', target: deploymentTemplateName, patch} ]
    }
}

export function appendDeploymentTemplateInBlueprint({templateName}: {templateName: string}): PreparedMutation {
    return function(accumulator) {
        // TODO should we take this as an arg?
        visitMutation('appendDeploymentTemplateInBlueprint')
        try {
            const blueprint = Object.keys(accumulator['ApplicationBlueprint'])[0]
            const patch = accumulator['ApplicationBlueprint'][blueprint]
            patch.deploymentTemplates.push(templateName)
            return [ {typename: 'ApplicationBlueprint', target: blueprint, patch} ]
        } catch(e) {
            console.error(e)
            return []
        }
    }
}

// KNOWN BUG: see "Known bugs to revisit" in the TypeScript plan -- each
// listed template is deleted with no deploymentTemplateName, which throws.
export function deleteDeploymentTemplate({slug, name}: {slug?: string, name?: string}): PreparedMutation {
    const target = (slug || name)!
    return function(accumulator) {
        visitMutation('deleteDeploymentTemplate')
        const deploymentTemplate = accumulator['DeploymentTemplate'][target]
        const result: (PatchDefinition | PreparedMutation)[] = []
        for(const resourceTemplate of deploymentTemplate.resourceTemplates) {
            result.push(deleteResourceTemplate({templateName: resourceTemplate} as DeleteTemplateArgs))
        }

        result.push(deleteDeploymentTemplateInBlueprint({templateName: deploymentTemplate.name}))
        result.push({typename: 'DeploymentTemplate', target, patch: null})

        return result
    }
}

export function deleteDeploymentTemplateInBlueprint({templateName}: {templateName: string}): PreparedMutation {
    return function(accumulator) {
        visitMutation('deleteDeploymentTemplateInBlueprint')
        // TODO should we take this as an arg?
        const blueprint = Object.keys(accumulator['ApplicationBlueprint'])[0]
        const patch = accumulator['ApplicationBlueprint'][blueprint]
        const index = patch.deploymentTemplates.indexOf(templateName)
        if(index != -1) patch.deploymentTemplates.splice(index, 1)
        return [ {typename: 'ApplicationBlueprint', target: blueprint, patch} ]
    }
}

interface DeleteTemplateArgs {
    templateName: string
    deploymentTemplateName: string
    dependentName?: string
    dependentRequirement?: string
}

export function deleteResourceTemplate({templateName, deploymentTemplateName, dependentName, dependentRequirement}: DeleteTemplateArgs): PreparedMutation {
    return function(accumulator) {
        visitMutation('deleteResourceTemplate')
        const result: (PatchDefinition | PreparedMutation)[] = []
        const deploymentTemplate = accumulator.DeploymentTemplate[deploymentTemplateName]

        if(deploymentTemplate.ResourceTemplate && deploymentTemplate.ResourceTemplate[templateName]) {
            delete deploymentTemplate.ResourceTemplate[templateName]
            result.push( {typename: 'DeploymentTemplate', target: deploymentTemplateName, patch: deploymentTemplate} )
        } else {
            const patch = null
            result.push( {typename: 'ResourceTemplate', target: templateName, patch} )
        }

        if(deploymentTemplateName) {
            result.push(
                deleteResourceTemplateInDT({templateName, deploymentTemplateName})//(accumulator)[0]
            )
        }

        if(dependentName && dependentRequirement) {
            result.push(
                deleteResourceTemplateInDependent({dependentName, dependentRequirement, deploymentTemplateName})
            )
        }

        return result
    }
}

interface DependentArgs {
    templateName: string
    dependentName: string
    dependentRequirement: string
    deploymentTemplateName: string
}

export function appendResourceTemplateInDependent(args: DependentArgs): PreparedMutation {
    const {templateName, dependentName, dependentRequirement, deploymentTemplateName} = args
    return function (accumulator) {
        visitMutation('appendResourceTemplateInDependent')
        let patch, typename
        const result: (PatchDefinition | PreparedMutation)[] = []

        try {
            const deploymentTemplate = accumulator['DeploymentTemplate'][deploymentTemplateName]
            patch = deploymentTemplate['ResourceTemplate'][dependentName]

            if(patch && deploymentTemplate._sourceTemplate) {
                result.push(
                    deleteResourceTemplate({templateName: dependentName, deploymentTemplateName: deploymentTemplate.name})
                )

                result.push(
                    {typename: 'ResourceTemplate', target: dependentName, patch: {...deploymentTemplate.ResourceTemplate[dependentName], _local: false}}
                )

                return [...result, appendResourceTemplateInDependent(args)]
            }

            typename = 'DeploymentTemplate'
        } catch(e) {}

        if(!patch) {
            patch = accumulator['ResourceTemplate'][dependentName]
            typename = 'ResourceTemplate'
        }

        for(const dependency of patch.dependencies) {
            if(dependency.name == dependentRequirement) {
                dependency.match = templateName
            }
        }

        if(patch._local) {
            const deploymentTemplatePatch = accumulator['DeploymentTemplate'][deploymentTemplateName]
            deploymentTemplatePatch.ResourceTemplate[patch.name] = patch
            result.push({typename: 'DeploymentTemplate', target: deploymentTemplateName, patch: deploymentTemplatePatch})
        } else {
            result.push({typename: 'ResourceTemplate', target: dependentName, patch})
        }
        return result
    }
}

export function deleteResourceTemplateInDependent({dependentName, dependentRequirement, deploymentTemplateName}: Omit<DependentArgs, 'templateName'>): PreparedMutation {
    return function (accumulator) {
        visitMutation('deleteResourceTemplateInDependent')
        let patch: Json | null | undefined
        let typename: string

        function clearMatch() {
            for(const dependency of patch!.dependencies) {
                // this is a weak check, we should see that dependency.match is correct
                if(dependency.name == dependentRequirement && dependency.match) {
                    dependency.match = null
                    return true
                }
            }
            return false
        }

        try {
            patch = accumulator['DeploymentTemplate'][deploymentTemplateName]['ResourceTemplate'][dependentName]
            typename = 'DeploymentTemplate'
        } catch(e) {}

        if(patch && !clearMatch()) {
            patch = null
        }

        if(!patch) {
            patch = accumulator['ResourceTemplate'][dependentName]
            typename = 'ResourceTemplate'

            // if(patch && !clearMatch()) {
            // TODO template being mutated elsewhere?
            if(patch) {
                clearMatch()
                // patch = null
            }
        }

        if(patch) {
            return [ {typename: typename!, target: patch.name, patch} ]
        }

        return []
    }
}

export function createResourceTemplate({type, name, title, description, properties, dependencies, deploymentTemplateName, dependentName, dependentRequirement, imported, ...passthru}: TemplateArgs & {properties?: Json[], deploymentTemplateName?: string, imported?: string}): PreparedMutation {
    return function(accumulator) {
        visitMutation('createResourceTemplate')
        const result: (PatchDefinition | PreparedMutation)[] = []

        if(deploymentTemplateName) {
            result.push(
                appendResourceTemplateInDT({templateName: name, deploymentTemplateName})//(accumulator)[0]
            )
        }

        if(dependentName && dependentRequirement) {
            result.push(
                appendResourceTemplateInDependent({templateName: name, dependentName, dependentRequirement, deploymentTemplateName: deploymentTemplateName!})//(accumulator)[0]
            )
        }

        const resourceType = typeof(type) == 'string'? Object.values(accumulator['ResourceType']).find(rt => rt.name == type): type
        let _properties = properties
        if(!_properties) {
            try {
                _properties = Object.entries(resourceType.inputsSchema.properties || {}).map(([key, inProp]) => ({name: key, value: (inProp as Json).default ?? null}))
            } catch(e) { _properties = [] }
        }

        let _dependencies = dependencies
        // duplicated logic, avoid using
        if(!_dependencies) {
            _dependencies = resourceType?.requirements?.map((req: Json) => ({
                constraint: req,
                match: req.match ?? null,
                target: null,
                name: req.name,
                __typename: 'Dependency'
            })) || []
        }

        const patch = {
            type: typeof(type) == 'string'? type: type.name,
            name,
            title,
            description,
            imported,
            ...passthru,
            __typename: "ResourceTemplate",
            properties: _properties,
            dependencies: _dependencies
        }

        result.push({patch, target: name, typename: "ResourceTemplate"})

        return result
    }
}

export function createResourceTemplateInDeploymentTemplate({type, name, title, description, properties, dependencies, deploymentTemplateName, dependentName, dependentRequirement, imported, ...passthru}: TemplateArgs & {properties?: Json[], deploymentTemplateName: string, imported?: string}): PreparedMutation {
    return function(accumulator) {
        visitMutation('createResourceTemplateInDeploymentTemplate')
        const result: (PatchDefinition | PreparedMutation)[] = []

        if(dependentName && dependentRequirement) {
            result.push(
                appendResourceTemplateInDependent({templateName: name, dependentName, dependentRequirement, deploymentTemplateName})//(accumulator)[0]
            )
        }

        const newResourceTemplate = {
            type: typeof(type) == 'string'? type: type.name,
            name,
            title,
            description,
            properties,
            dependencies,
            imported,
            ...passthru,
            __typename: "ResourceTemplate",
        }

        const patch = accumulator.DeploymentTemplate[deploymentTemplateName]

        if(!patch.ResourceTemplate) {
            patch.ResourceTemplate = {}
        }

        patch.ResourceTemplate[name] = newResourceTemplate

        result.push({patch, target: name, typename: "DeploymentTemplate"})

        return result
    }
}

function expectParam(paramName: string, functionName: string, paramValue: unknown) {
    if(!paramValue) {
        throw new Error(`Expected valid ${paramName} in ${functionName} (got ${paramValue})`)
    }
}

export function createDeploymentTemplate({blueprintName, primary, primaryName, primaryType, name, title, slug, description}: {
    blueprintName: string
    primary: string
    primaryName?: string
    primaryType: string | Json
    name?: string
    title?: string
    slug?: string
    description?: string
}): PreparedMutation {
    expectParam('blueprintName', 'createDeploymentTemplate', blueprintName)
    expectParam('name', 'createDeploymentTemplate', name || slug)
    console.warn('prepared createDeploymentTemplate is untested')
    return function(accumulator) {
        visitMutation('createDeploymentTemplate')
        const result: (PatchDefinition | PreparedMutation)[] = []

        const type = primaryType

        const _slug = slug || name
        const _name = (name || slug)!

        const _primaryName = primaryName? primaryName: slugify(`${_name} ${primary}`)
        const patch = {
            primary: _primaryName,
            name: _name,
            blueprint: blueprintName,
            slug: _slug,
            description,
            title,
            __typename: "DeploymentTemplate",
            //resourceTemplates: [slugify(primary)], gets added in createResourceTemplate
        }

        result.push({patch, target: _name, typename: 'DeploymentTemplate'})

        result.push(
            createResourceTemplate({type, name: _primaryName, title: primary, description, deploymentTemplateName: name})//(accumulator)[0]
        )

        result.push(
            appendDeploymentTemplateInBlueprint({templateName: _name})//(accumulator)[0]
        )

        return result


    }
}


function readCommittedNames(accumulator: Accumulator) {
    const committedNames: string[] = []
    for(const typename in accumulator) {
        if(['ResourceTemplate', 'ApplicationBlueprint', 'DeploymentTemplate', 'DeploymentEnvironment'].includes(typename)) {
            for(const name in accumulator[typename]) {
                committedNames.push(`${typename}.${name}`)
            }
        }
    }
    return committedNames
}

interface State {
    preparedMutations: PreparedMutation[]
    // mutations before this index are disregarded when asking for unsaved changes
    effectiveFirstMutation: number
    accumulator: Accumulator
    patches: Accumulator
    deploymentParams: Json
    path: string | null | undefined
    projectPath?: string | null
    environmentScope?: string
    committedNames: string[]
    commitMessage: string | null
    commitBranch: string | null
    commitBranchIsNew: boolean
    blueprintBranch: string | null
    updateType: string | null
    env: Record<string, unknown>
    isCommitting: boolean
    useBaseState: boolean
    // KNOWN BUG: written instead of preparedMutations; see the TypeScript plan
    preparedMutation?: PreparedMutation[]
}

type Context = ActionContext<State, any>

const state = (): State => ({
    preparedMutations: [],
    effectiveFirstMutation: 0,
    accumulator: {},
    patches: {},
    deploymentParams: {},
    path: null,
    committedNames: [],
    commitMessage: null,
    commitBranch: null,
    commitBranchIsNew: false,
    blueprintBranch: null,
    updateType: null,
    env: {},
    isCommitting: false,
    useBaseState: false
})

const getters = {
    getPreparedMutations(state: State) { return state.preparedMutations },
    getAccumulator(state: State) { return state.accumulator },
    getPatches(state: State) { return state.patches },
    hasPreparedMutations(state: State) { return state.preparedMutations.length > state.effectiveFirstMutation },
    safeToNavigateAway(state: State, getters: {hasPreparedMutations: boolean}) { return !getters.hasPreparedMutations && !state.isCommitting},
    isCommittedName(state: State) { return function(typename: string, name: string) {return state.committedNames.includes(`${typename}.${name}`)}},
    // CRITICAL: ensure this is called
    getCommitBranch(state: State) { return state.commitBranch}
}

const mutations = {
    setUpdateObjectPath(state: State, path: string | null | undefined) {
        if(state.preparedMutations.length > 0) {
            if(state.isCommitting) {
                throw new Error('Cannot update path while committing')
            }
            console.warn('Tried to update path with uncommitted mutations')
            // KNOWN BUG: not preparedMutations, so nothing is cleared; see the TypeScript plan
            state.preparedMutation = []
        }
        state.path = path
    },
    setUpdateObjectProjectPath(state: State, projectPath: string | null | undefined) {
        if(state.preparedMutations.length > 0) {
            if(state.isCommitting) {
                throw new Error('Cannot update projectPath while committing')
            }
            console.warn('Tried to update path with uncommitted mutations')
            state.preparedMutation = []
        }
        state.projectPath = projectPath
    },
    setDeploymentParams(state: State, deploymentParams: Json) {
        state.deploymentParams = deploymentParams
    },
    setCommitMessage(state: State, commitMessage: string | null) {
        state.commitMessage = commitMessage
    },
    setEnvironmentScope(state: State, environmentScope: string) {
        state.environmentScope = environmentScope
    },
    setCommitBranch(state: State, commitBranch: string | null) {
        state.commitBranch = commitBranch
        state.commitBranchIsNew = false
    },
    setCommitBranchIsNew(state: State, isNew: boolean) {
        state.commitBranchIsNew = isNew
    },
    setBlueprintBranch(state: State, blueprintBranch: string | null) {
        state.blueprintBranch = blueprintBranch
    },
    setUpdateType(state: State, updateType: string | null) {
        state.updateType = updateType
    },
    pushPreparedMutation(state: State, preparedMutation: PreparedMutation) {
        state.preparedMutations = [...state.preparedMutations, preparedMutation]
    },
    applyMutations(state: State, o?: {dryRun?: boolean}) {
        function applyPatchDefinition(patchDefinition: PatchDefinition | PreparedMutation) {
            if(typeof patchDefinition == 'function') {
                for(const _patchDefinition of patchDefinition(state.accumulator)) {
                    applyPatchDefinition(_patchDefinition)
                }
                return
            }
            const {typename, target, patch, env} = patchDefinition
            if(!state.accumulator[typename]) state.accumulator[typename] = {}
            if(!state.patches[typename]) state.patches[typename] = {}
            if(env) {
                Object.assign(state.env, env)
            }

            const cloned = _.clone(patch)
            state.patches[typename][target] = cloned
            state.accumulator[typename][target] = cloned
        }
        for(const preparedMutation of state.preparedMutations) {
            for(const patchDefinition of preparedMutation(state.accumulator)){
                applyPatchDefinition(patchDefinition)
            }
        }
        if(!o?.dryRun) state.preparedMutations = []
    },
    resetStagedChanges(state: State, o?: {dryRun?: boolean}) {
        state.accumulator = {}
        state.patches = {}
        state.env = {}
        state.committedNames = []
        state.useBaseState = false
        state.effectiveFirstMutation = 0
        if(!o?.dryRun) {
            state.path = undefined
            state.projectPath = undefined
            state.environmentScope = undefined
            state.commitMessage = null
            state.commitBranch = null
            state.commitBranchIsNew = false
            state.blueprintBranch = null
            state.updateType = null
            state.preparedMutations = []
        }
    },
    // TODO figure out whether this is necessary
    setBaseState(state: State, baseState: Accumulator) {
        state.accumulator = baseState
        state.committedNames = readCommittedNames(baseState)
    },
    // this one doesn't try to fetch a blueprint for the accumulator
    useBaseState(state: State, baseState: Accumulator) {
        state.accumulator = baseState
        state.committedNames = readCommittedNames(baseState)
        state.useBaseState = true
    },
    clearPreparedMutations(state: State) {
        state.preparedMutations = []
    },
    normalizePatches(state: State) {
        delete state.patches.DefaultTemplate
        for(const typename of Object.keys(state.patches)){
            for(const record of Object.values(state.patches[typename])) {
                if(record && typeof record == 'object') {

                    // not sure we should be committing things that are frozen to begin with
                    // currently happens while creating a deployment with developer access
                    if(Object.isFrozen(record)) continue

                    if(Serializers[typename]) {
                        const nestedPatches = Serializers[typename](record, state.accumulator)
                        if(Array.isArray(nestedPatches)) {
                            for(const p of nestedPatches) {
                                if(Serializers[p?.__typename])
                                    Serializers[p.__typename](p, record)
                            }
                        }
                    }

                    Serializers['*'](record, state.accumulator)
                }
            }
        }
    },
    clientDisregardUncommitted(state: State) {
        state.effectiveFirstMutation = state.preparedMutations.length
    },
    setIsCommitting(state: State, isCommitting: boolean) {
        state.isCommitting = isCommitting
    }
}


const actions = {
    async fetchRoot({commit, rootGetters}: Context) {
        const state = rootGetters.getApplicationRoot
        commit('setBaseState', _.cloneDeep(state))
    },

    async sendUpdateSubrequests({state, getters, commit, rootState, rootGetters}: Context, o?: {dryRun?: boolean}){
        // send environment variables before trying to commit changes
        try {
            if(o?.dryRun) {
                // eslint-disable-next-line no-console -- dryRun's output is the point
                console.log(state.env, state.environmentScope, state.projectPath)
            } else {
                await patchEnv(state.env as Parameters<typeof patchEnv>[0], state.environmentScope!, state.projectPath!, 0)
            }
        } catch(e) {
            commit(
                'createError',
                {
                    message: `Failed to update secrets -- aborting commit (${(e as Error).message})`,
                    context: {
                        environmentScope: state.environmentScope,
                        projectPath: state.projectPath
                    },
                    severity: 'critical'
                },
                {root: true}
            )
            return
        }

        const patch: Json[] = []
        for(let key in getters.getPatches) {
            const patchesByTypename = getters.getPatches[key]
            Object.entries(patchesByTypename as Record<string, Json | null>).forEach(([name, record]) => {
                if(record == null) {
                    if(state.committedNames.length == 0 || getters.isCommittedName(key, name)) {
                        patch.push({__deleted: true, name, __typename: key})
                    }
                }
                else if(!record?.directives?.includes('predefined')) {
                    patch.push({name, ...record, __typename: key})
                }
            })
        }

        if(o?.dryRun) {
            return {patch, state}
        }

        const projectPath = state.projectPath || rootState.project?.globalVars?.projectPath

        const project = await(fetchProjectInfo(encodeURIComponent(projectPath)))
        const projectId = project!.id!


        const token = rootGetters.lookupVariableByEnvironment('UNFURL_PROJECT_TOKEN', '*')

        const variables: Json = {}


        if(token) {
            variables.cloud_vars_url = unfurl_cloud_vars_url({
                token,
                protocol: window.location.protocol,
                server: window.location.host,
                projectId
            })
        }

        let sync: Promise<unknown> | undefined, method: string | undefined, path = state.path

        if(state.updateType == UPDATE_TYPE.deployment) {
            variables.deployment_path = path || state.deploymentParams?.deployPath
            if(!rootGetters.hasDeployPathKey(path)) {
                // infer information from the deployment object path instead of our getters
                // I'm not sure there's much to be gained here in terms of decoupling, but this should work better with clone

                variables.environment = state.deploymentParams?.environmentName
                variables.deployment_blueprint = state.deploymentParams?.deploymentBlueprint
                variables.blueprint_url = state.deploymentParams?.projectUrl?
                    new URL(state.deploymentParams.projectUrl) : null

                if(variables.blueprint_url) {
                    const password = await fetchUserAccessToken()
                    if(password) {
                        variables.blueprint_url.password = password
                    }
                }

                if(variables.blueprint_url) {
                    variables.blueprint_url = variables.blueprint_url.toString()
                } else {
                    delete variables.blueprint_url
                }

                method = 'create_ensemble'
            } else {
                method = 'update_ensemble'
            }
        } else if (state.updateType == UPDATE_TYPE.blueprint) {
            if(!path) {
                path = 'ensemble-template.yaml'
            }
            variables.deployment_path = path
            method = 'update_ensemble'
        } else if(state.updateType == UPDATE_TYPE.deleteDeployment) {
            if(!path) {
                path = 'unfurl.yaml'
            }
            method = 'delete_deployment'
        } else if(state.updateType == UPDATE_TYPE.deleteEnvironment) {
            if(!path) {
                path = 'unfurl.yaml'
            }
            method = 'delete_environment'
        } else if(state.updateType == UPDATE_TYPE.environment) {
            if(!path) {
                path = 'unfurl.yaml'
            }

            method = 'update_environment'

            // The patch is seeded from the normalized store, where every
            // ResourceTemplate carries `directives`, so an untouched provider
            // round-trips an empty one into unfurl.yaml. The user never set it,
            // so don't write it -- but leave a non-empty one alone.
            //
            // Rebuilt rather than deleted in place: a patch entry is a shallow
            // spread of the store's record, so its connections are still the
            // store's own objects and vuex strict mode throws on the delete.
            for(const environmentPatch of patch) {
                if(environmentPatch.__typename != 'DeploymentEnvironment') continue
                if(!environmentPatch.connections) continue
                environmentPatch.connections = Object.fromEntries(
                    Object.entries(environmentPatch.connections as Record<string, Json>).map(([name, connection]) => {
                        if(connection && !connection.directives?.length) {
                            const {directives, ...withoutDirectives} = connection
                            return [name, withoutDirectives]
                        }
                        return [name, connection]
                    })
                )
            }

            // TODO be more selective about which patches to run this on
            sync = Promise.all(
                patch
                    .filter(p => p.__typename == 'DeploymentEnvironment' && p.name != 'defaults' && p.connections?.primary_provider)
                    .map(p => declareAvailableProviders(
                        projectPath,
                        p.name,
                        //guarunteed ordering of primary_provider first
                        [p.connections.primary_provider].concat((Object.values(p.connections) as Json[]).filter(conn => conn.name != 'primary_provider'))
                            .map((provider: Json) => provider.type)
                    ))
            ).catch(e => {
                // The write goes ahead regardless, so failing the save here
                // would misreport it. Only the GitLab environment's provider
                // record is missing.
                commit(
                    'createError',
                    {
                        message: `Saved, but the environment's cloud providers could not be recorded in GitLab (${e.message})`,
                        context: e.response?.data || e,
                        severity: 'major'
                    },
                    {root: true}
                )
            })
        }

        // current-then-default: updates must land on (and key sessionStorage by)
        // the same branch exports were served from, or getLastCommit misses
        const branch = state.commitBranch || await getOrFetchCurrentBranch(encodeURIComponent(projectPath))

        if (state.commitBranchIsNew && !window.gon.unfurl_gui) {
            await createBranch(encodeURIComponent(projectPath), branch!)
            commit('setCommitBranchIsNew', false)
        }

        const post = unfurlServerUpdate({
            method: method!,
            projectPath,
            branch,
            patch,
            commitMessage: state.commitMessage ?? undefined,
            variables
        }).catch((e: Error & {response?: {data?: unknown}}) => {
            commit(
                'createError',
                {
                    message: `Failed to commit update to ${path} (${e.message})`,
                    // The server's body *is* the context. Nesting it under
                    // `response` put `details` a level below where the errors
                    // store looks for it, so a python traceback rendered as
                    // part of a property blob instead of in the panel built for
                    // it -- and a write discarded asynchronously, which carries
                    // the same body, would have rendered differently from this
                    // one. `e` when the request never got a response: the store
                    // unwraps an Error to its message.
                    context: e.response?.data || e,
                    request: {
                        method,
                        projectPath,
                        branch,
                        patch,
                        commitMessage: state.commitMessage,
                        variables,
                    },
                    severity: 'critical'
                },
                {root: true}
            )
        })

        await Promise.all([post, sync])
    },

    async commitPreparedMutations({state, dispatch, commit}: Context, o?: {dryRun?: boolean}) {
        if(!UPDATE_TYPE[state.updateType as keyof typeof UPDATE_TYPE]) {
            throw new Error('Save changes: An update type must be specified before committing mutations')
        }

        commit('setIsCommitting', true)
        // A failure keeps the staged changes for a retry, but must not leave us
        // committing: that blocks navigation and every later path change.
        try {
            let dryRun = o?.dryRun
            if(!state.useBaseState) {
                await dispatch('fetchRoot')
            }
            commit('applyMutations', {dryRun})
            commit('normalizePatches')
            const result = await dispatch('sendUpdateSubrequests', {dryRun})
            commit('resetStagedChanges', {dryRun})
            return result
        } finally {
            commit('setIsCommitting', false)
        }
    }
}

export default {
    state,
    mutations,
    actions,
    getters
} satisfies Module<State, any>
