import { __ } from "~/locale";
import _ from 'lodash'
import graphqlClient from '../../graphql';
import gql from 'graphql-tag';
import {slugify} from 'oc_vue_shared/util.mjs'
import {lookupCloudProviderAlias} from 'oc_vue_shared/util.mjs'
import {patchEnv} from 'oc_vue_shared/client_utils/envvars'
import {fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
import {fetchUserAccessToken} from 'oc_vue_shared/client_utils/user'
import {unfurl_cloud_vars_url} from 'oc_vue_shared/client_utils/unfurl-invocations'
import axios from '~/lib/utils/axios_utils'

export const UPDATE_TYPE = {deployment: 'deployment', DEPLOYMENT: 'deployment', environment: 'environment', ENVIRONMENT: 'environment', deleteDeployment: 'delete-deployment', DELETE_DEPLOYMENT: 'delete-deployment'}

const SECRET_DIRECTIVE = "get_env"
/*
 * this module is used to prepare a set of patches and push them to correct path using updateDeploymentObj
 * the shape of areguments passed to updateDeploymentObj changed after this module was created, so there are unnecessary transformations and an internal representation of patches that doesn't make much sense

 * this module also handles posting environment variables for sensitive inputs and cleaning up state before it's committed
 * some of the normalizations done prior to committing are done to prevent errors in unfurl

 * there are some exported functions that are expected to be used in combination with pushPreparedMutation
 * the behavior for these is a bit unusual and if you need to directly commit an object, I'd committing pushPreparedMutation like this:   
          this.pushPreparedMutation(() => {
             return [{
               typename: 'DeploymentPath',
               patch: {__typename: 'DeploymentPath', environment},
               target: this.deploymentDir
             }] 


 * some concepts like committedNames and fetchRoot are inconsistent between targets (i.e. deployment.json vs environments.json)
 * this is pretty ugly and what I'd consider refactoring first
*/

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

let Serializers
Serializers = {
    DeploymentEnvironment(env) {
        allowFields(env, 'connections', 'instances', 'external', 'repositories')
        fieldsToDictionary(env, 'connections', 'instances')

        if(env.instances.primary_provider) {
            env.connections.primary_provider = env.instances.primary_provider
            delete env.instances.primary_provider
        }

        for(const [name, instance] of Object.entries(env.instances)) {
            if(lookupCloudProviderAlias(instance.type)) {
                env.connections[name] = env.instances[name]
                delete env.instances[name]
            }
        }

        return Object.values(env.instances || {}).concat(Object.values(env.connections))
    },
    DeploymentTemplate(dt, state) {
        // should we be serializing local templates?
        const localResourceTemplates = dt?.ResourceTemplate
        if(localResourceTemplates) {
            for(const rt of Object.keys(localResourceTemplates)) {
                if(state.ResourceTemplate.hasOwnProperty(rt) && !state.ResourceTemplate[rt]?.directives?.includes('default')) {
                    delete localResourceTemplates[rt]
                } else {
                    Serializers.ResourceTemplate(localResourceTemplates[rt], state)
                }
            }
        }
        /*
        const resourceTemplates = []
        function addMatchedResourceTemplates(templateName) {
            let template 
            try {
                template = state.DeploymentTemplate[dt.name].ResourceTemplate[templateName]
            } catch(e) {}
            if(!template) {
                template = state.ResourceTemplate[templateName]
            }

            if(template) {
                resourceTemplates.push(templateName)
                template.dependencies?.forEach(dep => dep.match && addMatchedResourceTemplates(dep.match))
            }
        }
        addMatchedResourceTemplates(dt.primary)
        */
        dt.resourceTemplates = _.union(Object.keys(localResourceTemplates || {}), Object.keys(state.ResourceTemplate || {}))
    },
    // TODO unit test
    ResourceTemplate(rt) {
        if(rt.__typename == 'Resource') return Serializers.Resource(rt)

        if(rt.directives?.includes('select')) {
            allowFields(rt, 'name', 'title', 'directives', 'imported', 'type', '__typename')
            return
        }
        try {
            delete rt.visibility // do not commit template visibility
        } catch(e) {
            console.error(e) // seems to happen when visibility was already set?
        }
        rt.dependencies = rt.dependencies?.filter(dep => {
            return dep.match || dep.target || dep.constraint.match
        })

        rt.properties = _.unionBy(rt.properties, rt.computedProperties, 'name')
        
        // This won't filter out any required properties because the user shouldn't be allowed 
        // to deploy with null required values
        rt.properties = rt.properties?.filter(prop => {
            return (prop.value ?? null) !== null
        })

        // check deep
        // TODO unit test this function
        _.forOwn(rt.properties, (value, key) => {
            if(typeof value == 'object') {
                Object.entries(value).forEach(([childKey, childValue]) => {
                    if((childValue ?? null) === null)
                        delete value[childKey]
                })
            }
        })

        rt.dependencies?.forEach(dep => {
            if(! dep.constraint.visibility) {
                dep.constraint.visibility = 'visibile' // ensure visibility is committed by the client
            }
        })
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
        console.log('resource!', resource)
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
            _propertyValue = {[SECRET_DIRECTIVE]: envname}
        }
        const patch = accumulator['DeploymentEnvironment'][environmentName]
        let instance = Array.isArray(patch.instances) ?
            patch.instances.find(i => i.name == templateName) :
            patch.instances[templateName]
        
        if(!instance) {
            instance = Array.isArray(patch.connections) ?
                patch.connections.find(i => i.name == templateName) :
                patch.connections[templateName]
        }
        const property = instance.properties.find(p => p.name == propertyName)
        property.value = _propertyValue
        return [ {typename: 'DeploymentEnvironment', target: templateName, patch, env} ]
    }
}

export function createEnvironmentInstance({type, name, title, description, dependencies, environmentName, dependentName, dependentRequirement}) {
    return function(accumulator) {
        const resourceType = typeof(type) == 'string'? Object.values(accumulator['ResourceType']).find(rt => rt.name == type): type
        let properties 
        try {
            properties = Object.entries(resourceType.inputsSchema.properties || {}).map(([key, inProp]) => ({name: key, value: inProp.default ?? null}))
        } catch(e) { properties = [] }

        /*
        const dependencies = resourceType?.requirements?.map(req => ({
            constraint: req,
            match: null,
            target: null,
            name: req.name,
            __typename: 'Dependency'
        })) || []
        */

        const template = {
            type: typeof(type) == 'string'? type: type.name,
            name,
            title,
            description,
            __typename: "ResourceTemplate",
            properties,
            dependencies: dependencies || []
        }

        const patch = accumulator['DeploymentEnvironment'][environmentName]
        if(! Array.isArray(patch.instances)) {
            patch.instances = []
        }
        if(dependentName) {
            const dependent = patch.instances.find(rt => rt.name == dependentName)
            const dependency = dependent?.dependencies?.find(dep => dep.name == dependentRequirement)
            if(dependency) {
                dependency.match = template.name
            }
        }

        patch.instances.push(template)


        return [ {typename: 'DeploymentEnvironment', target: environmentName, patch} ]
    }
}

export function deleteEnvironmentInstance({templateName, environmentName, dependentName, dependentRequirement}) {
    return function(accumulator) {
        const patch = accumulator['DeploymentEnvironment'][environmentName]
        const index = patch.instances.findIndex(instance => instance.name == templateName)
        if(index != -1) {
            patch.instances.splice(index, 1)

            if(dependentName) {
                const dependent = patch.instances.find(rt => rt.name == dependentName)
                const dependency = dependent?.dependencies?.find(dep => dep.name == dependentRequirement)
                if(dependency) {
                    dependency.match = null
                }
            }
        } else {
            const index = patch.connections.findIndex(connection => connection.name == templateName)
            if(index != -1) {
                patch.connections.splice(index, 1)
            }
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
            _propertyValue = {[SECRET_DIRECTIVE]: envname}
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
                deleteResourceTemplateInDependent({dependentName, dependentRequirement, deploymentTemplateName})
            )

        }

        return result
    }
}

export function appendResourceTemplateInDependent({templateName, dependentName, dependentRequirement, deploymentTemplateName}) {
    return function (accumulator) {
        let patch, typename
        try { 
            patch = accumulator['DeploymentTemplate'][deploymentTemplateName]['ResourceTemplate'][dependentName]
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
        return [ {typename: 'ResourceTemplate', target: dependentName, patch} ]
    }
}

export function deleteResourceTemplateInDependent({dependentName, dependentRequirement, deploymentTemplateName}) {
    return function (accumulator) {
        let patch
        let typename
        try {
            patch = accumulator['DeploymentTemplate'][deploymentTemplateName]['ResourceTemplate'][dependentName]
            typename = 'DeploymentTemplate'
        } catch(e) {}

        if(!patch) {
            patch = accumulator['ResourceTemplate'][dependentName]
            typename = 'ResourceTemplate'
        }

        for(const dependency of patch.dependencies) {
            if(dependency.name == dependentRequirement) {
                dependency.match = null
            }
        }

        return [ {typename: 'ResourceTemplate', target: dependentName, patch} ]
    }
}

export function createResourceTemplate({type, name, title, description, properties, dependencies, deploymentTemplateName, dependentName, dependentRequirement, imported}) {
    return function(accumulator) {
        const result = []

        if(deploymentTemplateName) {
            result.push(
                appendResourceTemplateInDT({templateName: name, deploymentTemplateName})//(accumulator)[0]
            )
        }

        if(dependentName && dependentRequirement) {
            result.push(
                appendResourceTemplateInDependent({templateName: name, dependentName, dependentRequirement, deploymentTemplateName})//(accumulator)[0]
            )
        }

        const resourceType = typeof(type) == 'string'? Object.values(accumulator['ResourceType']).find(rt => rt.name == type): type
        let _properties = properties
        if(!_properties) {
            try {
                _properties = Object.entries(resourceType.inputsSchema.properties || {}).map(([key, inProp]) => ({name: key, value: inProp.default ?? null}))
            } catch(e) { _properties = [] }
        }

        let _dependencies = dependencies
        // duplicated logic, avoid using
        if(!_dependencies) {
            _dependencies = resourceType?.requirements?.map(req => ({
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
            __typename: "ResourceTemplate",
            properties: _properties,
            dependencies: _dependencies
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

        const type = primaryType

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


function readCommittedNames(accumulator) {
    const committedNames = []
    for(const typename in accumulator) {
        if(['ResourceTemplate', 'ApplicationBlueprint', 'DeploymentTemplate'].includes(typename)) {
            for(const name in accumulator[typename]) {
                committedNames.push(`${typename}.${name}`)
            }
        }
    }
    return committedNames
}

const state = () => ({
    preparedMutations: [],
    accumulator: {},
    patches: {},
    committedNames: [],
    commitMessage: null,
    branch: null,
    updateType: null,
    env: {},
    isCommitting: false,
    useBaseState: false
})

const getters = {
    getPreparedMutations(state) { return state.preparedMutations },
    getAccumulator(state) { return state.accumulator },
    getPatches(state) { return state.patches },
    hasPreparedMutations(state) { return state.preparedMutations.length > (state.effectiveFirstMutation || 0) },
    safeToNavigateAway(state, getters) { return !getters.hasPreparedMutations && !state.isCommitting},
    isCommittedName(state) { return function(typename, name) {return state.committedNames.includes(`${typename}.${name}`)}},

}

const mutations = {
    setUpdateObjectPath(state, path) {
        if(state.preparedMutations.length > 0) {
            if(state.isCommitting) {
                throw new Error('Cannot update path while committing')
            }
            console.error('Tried to update path with uncommitted mutations')
            state.preparedMutation = []
        }
        state.path = path
    },
    setUpdateObjectProjectPath(state, projectPath) {
        if(state.preparedMutations.length > 0) {
            if(state.isCommitting) {
                throw new Error('Cannot update projectPath while committing')
            }
            console.error('Tried to update path with uncommitted mutations')
            state.preparedMutation = []
        }
        state.projectPath = projectPath
    },
    setCommitMessage(state, commitMessage) {
        state.commitMessage = commitMessage
    },
    setEnvironmentScope(state, environmentScope) {
        state.environmentScope = environmentScope
    },
    setCommitBranch(state, branch) {
        state.branch = branch
    },
    setUpdateType(state, updateType) {
        state.updateType = updateType
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
        state.committedNames = []
        state.useBaseState = false
        state.effectiveFirstMutation = 0
        if(!o?.dryRun) {
            state.path = undefined
            state.projectPath = undefined
            state.environmentScope = undefined
            state.commitMessage = null
            state.branch = null
            state.updateType = null
            state.preparedMutations = []
        }
    },
    // TODO figure out whether this is necessary
    setBaseState(state, baseState) {
        state.accumulator = baseState
        state.committedNames = readCommittedNames(baseState)
    },
    // this one doesn't try to fetch a blueprint for the accumulator
    useBaseState(state, baseState) {
        state.accumulator = baseState
        state.committedNames = readCommittedNames(baseState)
        state.useBaseState = true
    },
    clearPreparedMutations(state) {
        state.preparedMutations = []
    },
    normalizePatches(state) {
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
                                if(Serializers[p.__typename])
                                    Serializers[p.__typename](p, record)
                            }
                        }
                    }

                    Serializers['*'](record, state.accumulator)
                }
            }
        }
    },
    clientDisregardUncommitted(state) {
        state.effectiveFirstMutation = state.preparedMutations.length
    },
    setIsCommitting(state, isCommitting) {
        state.isCommitting = isCommitting
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

    async sendUpdateSubrequests({state, getters, commit, rootState, rootGetters}, o){
        // send environment variables before trying to commit changes
        if(o?.dryRun) {
            console.log(state.env, state.environmentScope, state.projectPath)
        } else {
            await patchEnv(state.env, state.environmentScope, state.projectPath)
        }

        const patch = []
        for(let key in getters.getPatches) {
            const patchesByTypename = getters.getPatches[key]
            Object.entries(patchesByTypename).forEach(([name, record]) => {
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

        const username = rootGetters.getUsername
        const password = await fetchUserAccessToken()
        let projectPath = state.projectPath || rootState.project?.globalVars?.projectPath

        const projectId = (await(fetchProjectInfo(encodeURIComponent(projectPath))))?.id

        projectPath = new URL(window.location.origin + '/' + projectPath)
        projectPath.username = username
        projectPath.password = password

        projectPath = projectPath.toString()

        const variables = {
            projectPath,
            project_path: projectPath,
            patch, 
            project_id: projectId,
            path: state.path
        }

        if(state.commitMessage) {
            variables.commit_msg = state.commitMessage
        }

        const token = rootGetters.lookupVariableByEnvironment('UNFURL_PROJECT_TOKEN', '*')

        if(token) {
            variables.cloud_vars_url = unfurl_cloud_vars_url({
                token,
                protocol: window.location.protocol,
                server: window.location.host,
                projectId
            })
        }


        if(o?.dryRun) {
            console.log(state.committedNames)
            console.log(variables)
            if(Object.keys(state.env)) console.log(state.env)
            return
        }

        let post
        if(state.updateType == UPDATE_TYPE.deployment) {
            variables.deployment_path = variables.path
            if(!rootGetters.hasDeployPathKey(variables.path)) {

                // infer information from the deployment object path instead of our getters
                // I'm not sure there's much to be gained here in terms of decoupling, but this should work better with clone

                const pathSplits = variables.path.split('/')
                pathSplits.shift()
                const environmentName = pathSplits.shift()
                const deploymentName = pathSplits.pop()
                const blueprintProjectPath = pathSplits.join('/')

                variables.environment = environmentName
                variables.deployment_blueprint = deploymentName

                variables.blueprint_url = new URL(window.location.origin + '/' + blueprintProjectPath + '.git')
                variables.blueprint_url.username = username
                variables.blueprint_url.password = password

                variables.blueprint_url = variables.blueprint_url.toString()

                post = axios.post('/services/unfurl/create_ensemble', variables)
            } else {
                post = axios.post(`/services/unfurl/update_ensemble`, variables)
            }
        } else if(state.updateType == UPDATE_TYPE.deleteDeployment) {
            post = axios.post(`/services/unfurl/delete_deployment`, variables)
        } else if(state.updateType == UPDATE_TYPE.environment) {
            if(!variables.path) {
                variables.path = 'environments.json'
            }
            post = axios.post(`/services/unfurl/update_environment`, variables)
        }

        await post
    },

    async commitPreparedMutations({state, dispatch, commit, getters}, o) {
        if(!UPDATE_TYPE[state.updateType]) {
            throw new Error('@commitPreparedMutations: An update type must be specified before committing mutations')
        }

        commit('setIsCommitting', true)
        let dryRun = o?.dryRun
        if(!state.useBaseState) {
            await dispatch('fetchRoot')
        }
        commit('applyMutations', {dryRun})
        commit('normalizePatches')
        await dispatch('sendUpdateSubrequests', {dryRun})
        commit('resetStagedChanges', {dryRun})
        commit('setIsCommitting', false)
    }
}

export default {
    state,
    mutations,
    actions,
    getters
}
