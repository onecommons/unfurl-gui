import { __ } from "~/locale";
import _ from 'lodash'
import graphqlClient from '../../graphql';
import gql from 'graphql-tag';
import axios from '~/lib/utils/axios_utils'
import {slugify} from '../../../vue_shared/util.mjs'
import {UpdateDeploymentObject} from  '../../graphql/mutations/update_deployment_object.graphql'
import {userDefaultPath} from '../../../vue_shared/util.mjs'
import {USER_HOME_PROJECT} from '../../../vue_shared/util.mjs'
import {patchEnv} from '../../../vue_shared/client_utils/envvars'


function convertFieldToDictionaryIfNeeded(node, field) {
    if(Array.isArray(node[field])) {
        const result = {}
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

function fieldsToDictionary(node, ...fields) {
    for(const field of fields) {
        convertFieldToDictionaryIfNeeded(node, field)
    }
}

function allowFields(node, ...fields) {
    for(const field in node) {
        if(field == 'name' || field == '__typename') continue
        if(!fields.includes(field)) {
            node[field] = undefined
        }
    }
}

function normalizeEnvName(_name) {
    let name = _name.startsWith('$')? _name.slice(1) : _name
    name = name.replace(/-/g, '_')
    if(! /^[a-zA-Z_]+[a-zA-Z0-9_]*$/.test(name)) {
        name = `_` + key.split('').map(c => c.charCodeAt(0).toString(16)).join('')
    }
    return name
}

const Serializers = {
    DeploymentEnvironment(env) {
        allowFields(env, 'connections', 'instances')
        fieldsToDictionary(env, 'connections', 'instances')
    },
    DeploymentTemplate(dt, state) {
        console.log(dt)
        const localResourceTemplates = dt?.ResourceTemplate
        if(localResourceTemplates) {
            for(const rt of Object.keys(localResourceTemplates)) {
                if(state.ResourceTemplate.hasOwnProperty(rt)) {
                    delete localResourceTemplates[rt]
                }
            }
        }
    },
    ResourceTemplate(rt) {
        rt.dependencies = rt.dependencies?.filter(dep => {
            return dep.match || dep.target
        })
    },
    '*': function(any) {
        for(const key in any) {
            if(key.startsWith('_')) {
                any[key] = undefined
            }
        }
        Object.freeze(any)
    }
}

function throwErrorsFromDeploymentUpdateResponse(...args) {
    if(!args.length) return
    let errors
    let errorArgIndex = args.length
    let data
    if(Array.isArray(args[0])) {
        errors = args[0]
        errorArgIndex = 0
    } else if (args.length > 1 && Array.isArray(args[1])) {
        errors = args[1]
        errorArgIndex = 1
    }

    if (errors?.length) throw new Error(errors)
    data = args[args.length - errorArgIndex]
    if(data?.errors?.length) throw new Error(data.errors)
    if(data?.data?.errors?.length) throw new Error(data.data.errors)
}

export function updatePropertyInInstance({environmentName, templateName, propertyName, propertyValue, isSensitive}) {
    return function(accumulator) {
        let _propertyValue = propertyValue
        let env
        if(isSensitive) {
            const envname = normalizeEnvName(`${templateName}__${propertyName}`)
            env = {[envname]: propertyValue}
            _propertyValue = {"get_env": envname}
        }
        const patch = accumulator['DeploymentEnvironment'][environmentName]
        const instance = Array.isArray(patch.instances) ?
            patch.instances.find(i => i.name == templateName) :
            patch.instances[templateName]
        
        const property = instance.properties.find(p => p.name == propertyName)
        property.value = _propertyValue
        return [ {typename: 'DeploymentEnvironment', target: templateName, patch, env} ]
    }
}

export function createEnvironmentInstance({type, name, title, description, environmentName}) {
    return function(accumulator) {
        const resourceType = typeof(type) == 'string'? Object.values(accumulator['ResourceType']).find(rt => rt.name == type): type
        let properties 
        try {
            properties = Object.entries(resourceType.inputsSchema.properties || {}).map(([key, inProp]) => ({name: key, value: inProp.default ?? null}))
        } catch(e) { properties = [] }

        const dependencies = resourceType?.requirements?.map(req => ({
            constraint: req,
            match: null,
            target: null,
            name: req.name,
            __typename: 'Dependency'
        })) || []

        const template = {
            type: typeof(type) == 'string'? type: type.name,
            name,
            title,
            description,
            __typename: "ResourceTemplate",
            properties,
            dependencies
        }

        const patch = accumulator['DeploymentEnvironment'][environmentName]
        if(! Array.isArray(patch.instances)) {
            patch.instances = []
        }

        patch.instances.push(template)


        return [ {typename: 'DeploymentEnvironment', target: environmentName, patch} ]
    }
}

export function deleteEnvironmentInstance({templateName, environmentName}) {
    return function(accumulator) {
        const patch = accumulator['DeploymentEnvironment'][environmentName]

        const index = patch.instances.findIndex(instance => instance.name == templateName)
        if(index != -1) {
            patch.instances.splice(index, 1)
        }

        return [ {typename: 'DeploymentEnvironment', target: environmentName, patch} ]
    }
}

export function updatePropertyInResourceTemplate({templateName, propertyName, propertyValue, isSensitive, deploymentName}) {
    return function(accumulator) {
        let _propertyValue = propertyValue
        let env
        if(isSensitive) {
            const envname = normalizeEnvName(`${deploymentName}__${templateName}__${propertyName}`)
            env = {[envname]: propertyValue}
            _propertyValue = {"get_env": envname}
        }
        const patch = accumulator['ResourceTemplate'][templateName]
        const property = patch.properties.find(p => p.name == propertyName)
        property.value = _propertyValue
        return [
            // reference this here so we delete local resource templates as necessary
            {typename: 'DeploymentTemplate', target: deploymentName, patch: accumulator['DeploymentTemplate'][deploymentName]},

            {typename: 'ResourceTemplate', target: templateName, patch, env}
        ]
    }
}

export function appendResourceTemplateInDT({templateName, deploymentTemplateName}) {
    return function(accumulator) {
        const patch = accumulator['DeploymentTemplate'][deploymentTemplateName] || {}
        if(Array.isArray(patch.resourceTemplates)) patch.resourceTemplates.push(templateName)
        else patch.resourceTemplates = [templateName]
        return [ {typename: 'DeploymentTemplate', target: deploymentTemplateName, patch} ]
    }
}

export function deleteResourceTemplateInDT({templateName, deploymentTemplateName}) {
    return function(accumulator) {
        const patch = accumulator['DeploymentTemplate'][deploymentTemplateName] || {}
        if(!patch.resourceTemplates)
            patch.resourceTemplates = []
        const index = patch.resourceTemplates.indexOf(templateName)
        if(index != -1) patch.resourceTemplates.splice(index, 1)
        return [ {typename: 'DeploymentTemplate', target: deploymentTemplateName, patch} ]
    }
}

export function appendDeploymentTemplateInBlueprint({templateName}) {
    return function(accumulator) {
        // TODO should we take this as an arg?
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

export function deleteDeploymentTemplate({slug, name}) {
    const target = slug || name
    return function(accumulator) {
        const deploymentTemplate = accumulator['DeploymentTemplate'][target]
        const result = []
        for(const resourceTemplate of deploymentTemplate.resourceTemplates) {
            result.push(deleteResourceTemplate({templateName: resourceTemplate}))
        }

        result.push(deleteDeploymentTemplateInBlueprint({templateName: deploymentTemplate.name, blueprintName: deploymentTemplate.blueprint}))
        result.push({typename: 'DeploymentTemplate', target, patch: null})

        return result
    }
}

export function deleteDeploymentTemplateInBlueprint({templateName}) {
    return function(accumulator) {
        // TODO should we take this as an arg?
        const blueprint = Object.keys(accumulator['ApplicationBlueprint'])[0]
        const patch = accumulator['ApplicationBlueprint'][blueprint]
        const index = patch.deploymentTemplates.indexOf(templateName)
        if(index != -1) patch.deploymentTemplates.splice(index, 1)
        return [ {typename: 'ApplicationBlueprint', target: blueprint, patch} ]
    }
}

export function deleteResourceTemplate({templateName, deploymentTemplateName, dependentName, dependentRequirement}) {
    return function(accumulator) {
        const patch = null
        const result = [ {typename: 'ResourceTemplate', target: templateName, patch} ]
        if(deploymentTemplateName) { 
            result.push(
                deleteResourceTemplateInDT({templateName, deploymentTemplateName})//(accumulator)[0]
            )
        }
        if(dependentName && dependentRequirement) {
            console.warn("this isn't tested yet")
            result.push(
                deleteResourceTemplateInDependent({dependentName, dependentRequirement})
            )

        }

        return result
    }
}

export function appendResourceTemplateInDependent({templateName, dependentName, dependentRequirement}) {
    return function (accumulator) {
        const patch = accumulator['ResourceTemplate'][dependentName]
        for(const dependency of patch.dependencies) {
            if(dependency.name == dependentRequirement) {
                dependency.match = templateName
            }
        }
        return [ {typename: 'ResourceTemplate', target: dependentName, patch} ]
    }
}

export function deleteResourceTemplateInDependent({dependentName, dependentRequirement}) {
    return function (accumulator) {
        const patch = accumulator['ResourceTemplate'][dependentName]
        for(const dependency of patch.dependencies) {
            if(dependency.name == dependentRequirement) {
                dependency.match = null
            }
        }

        return [ {typename: 'ResourceTemplate', target: dependentName, patch} ]
    }
}

export function createResourceTemplate({type, name, title, description, deploymentTemplateName, dependentName, dependentRequirement}) {
    return function(accumulator) {
        const result = []

        if(deploymentTemplateName) {
            result.push(
                appendResourceTemplateInDT({templateName: name, deploymentTemplateName})//(accumulator)[0]
            )
        }

        if(dependentName && dependentRequirement) {
            result.push(
                appendResourceTemplateInDependent({templateName: name, dependentName, dependentRequirement})//(accumulator)[0]
            )
        }

        const resourceType = typeof(type) == 'string'? Object.values(accumulator['ResourceType']).find(rt => rt.name == type): type
        let properties 
        try {
            properties = Object.entries(resourceType.inputsSchema.properties || {}).map(([key, inProp]) => ({name: key, value: inProp.default ?? null}))
        } catch(e) { properties = [] }

        const dependencies = resourceType?.requirements?.map(req => ({
            constraint: req,
            match: null,
            target: null,
            name: req.name,
            __typename: 'Dependency'
        })) || []
        const patch = {
            type: typeof(type) == 'string'? type: type.name,
            name,
            title,
            description,
            __typename: "ResourceTemplate",
            properties,
            dependencies
        }

        result.push({patch, target: name, typename: "ResourceTemplate"})

        return result
    }
}


function expectParam(paramName, functionName, paramValue) {
    if(!paramValue) {
        throw new Error(`Expected valid ${paramName} in ${functionName} (got ${paramValue})`)
    }
}

export function createDeploymentTemplate({blueprintName, primary, primaryName, primaryType, name, title, slug, description}) {
    expectParam('blueprintName', 'createDeploymentTemplate', blueprintName)
    expectParam('name', 'createDeploymentTemplate', name || slug)
    console.warn('prepared createDeploymentTemplate is untested')
    return function(accumulator) {
        const result = []

        const type = primaryType//getters.getProjectInfo.primary.name

        const _slug = slug || name
        const _name = name || slug

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

const state = {
    preparedMutations: [],
    accumulator: {},
    patches: {},
    env: {},
    useBaseState: false
}

const getters = {
    getPreparedMutations(state) { return state.preparedMutations },
    getAccumulator(state) { return state.accumulator },
    getPatches(state) { return state.patches },
    hasPreparedMutations(state) { return state.preparedMutations.length > (state.effectiveFirstMutation || 0) }
}

const mutations = {
    setUpdateObjectPath(state, path) {
        if(state.preparedMutations.length > 0) {
            throw new Error('Cannot update path - you have uncommitted mutations')
        }
        state.path = path
    },
    setUpdateObjectProjectPath(state, projectPath) {
        if(state.preparedMutations.length > 0) {
            throw new Error('Cannot update projectPath - you have uncommitted mutations')
        }
        state.projectPath = projectPath
    },
    setEnvironmentScope(state, environmentScope) {
        state.environmentScope = environmentScope
    },
    pushPreparedMutation(state, preparedMutation) {
        state.preparedMutations.push(preparedMutation)
    },
    applyMutations(state, o) {
        function applyPatchDefinition(patchDefinition) {
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
    resetStagedChanges(state, o) {
        state.accumulator = {}
        state.patches = {}
        state.env = {}
        state.useBaseState = false
        state.effectiveFirstMutation = 0
        if(!o?.dryRun) {
            state.path = undefined
            state.projectPath = undefined
            state.environmentScope = undefined

        }
    },
    setBaseState(state, baseState) {
        state.accumulator = baseState
    },
    useBaseState(state, baseState) {
        state.accumulator = baseState
        state.useBaseState = true
    },
    clearPreparedMutations(state) {
        state.preparedMutations = []
    },
    normalizePatches(state) {
        for(const typename of Object.keys(state.patches)){
            for(const record of Object.values(state.patches[typename])) {
                if(record && typeof record == 'object') {
                    if(Serializers[typename]) {
                        Serializers[typename](record, state.accumulator)
                    }
                    Serializers['*'](record, state.accumulator)
                }
            }
        }
    },
    clientDisregardUncommitted(state) {
        state.effectiveFirstMutation = state.preparedMutations.length
    }
}


const actions = {
    async fetchRoot({commit, rootGetters, rootState}) {
        // use project_application_blueprint store if it's loaded
        const state = rootGetters.getApplicationRoot
        if(state?.loaded) {
            // clone to get rid of observers and frozen objects
            commit('setBaseState', JSON.parse(JSON.stringify(state)))
            return
        }

        // TODO stop using this query
        const query = gql`
            query GetTemplateStateBeforeUpdating($fullPath: ID!) {
                applicationBlueprintProject(fullPath: $fullPath, dehydrated: true) @client
            }
        `
        if(!rootState.project?.project?.globalVars?.projectPath) return
        const {data, errors} = await graphqlClient.clients.defaultClient.query({
            query,
            variables: {fullPath: rootState.project.globalVars.projectPath}
        })

        commit('setBaseState', data?.applicationBlueprintProject?.json)
    },

    async sendUpdateSubrequests({state, getters, rootState}, o){

        const patch = []
        for(let key in getters.getPatches) {
            const patchesByTypename = getters.getPatches[key]
            Object.entries(patchesByTypename).forEach(([name, record]) => {
                if(record == null) {
                    patch.push({__deleted: name, __typename: key})
                }
                else {
                    patch.push({name, ...record, __typename: key})
                }
            })
        }
        const variables = {
            fullPath: state.projectPath || rootState.project?.globalVars?.projectPath, 
            patch, 
            path: state.path || userDefaultPath()
        }

        if(o?.dryRun) {
            console.log(variables)
            if(Object.keys(state.env)) console.log(state.env)
            return
        }
        await graphqlClient.clients.defaultClient.mutate({
            mutation: UpdateDeploymentObject,
            variables
        })
        
        await patchEnv(state.env, state.environmentScope)
    },

    async commitPreparedMutations({state, dispatch, commit}, o) {
        let dryRun = o?.dryRun
        if(!state.useBaseState) {
            await dispatch('fetchRoot')
        }
        commit('applyMutations', {dryRun})
        commit('normalizePatches')
        await dispatch('sendUpdateSubrequests', {dryRun})
        commit('resetStagedChanges', {dryRun})
    }
}

export default {
    state,
    mutations,
    actions,
    getters
}
