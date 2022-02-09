import { cloneDeep } from 'lodash';
import { __ } from "~/locale";
import graphqlClient from '../../graphql';
import gql from 'graphql-tag';
import {slugify} from '../../../vue_shared/util.mjs'
import {UpdateDeploymentObject} from  '../../graphql/mutations/update_deployment_object.graphql'
import {userDefaultPath} from '../../../vue_shared/util.mjs'

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

export function updatePropertyInResourceTemplate({templateName, propertyName, propertyValue}) {
    return function(accumulator) {
        const patch = accumulator['ResourceTemplate'][templateName]
        const property = patch.properties.find(p => p.name == propertyName)
        property.value = propertyValue
        return [ {typename: 'ResourceTemplate', target: templateName, patch} ]
    }
}

export function appendResourceTemplateInDT({templateName, deploymentTemplateName}) {
    return function(accumulator) {
        const patch = accumulator['DeploymentTemplate'][deploymentTemplateName]
        if(Array.isArray(patch.resourceTemplates)) patch.resourceTemplates.push(templateName)
        else patch.resourceTemplates = [templateName]
        return [ {typename: 'DeploymentTemplate', target: deploymentTemplateName, patch} ]
    }
}

export function deleteResourceTemplateInDT({templateName, deploymentTemplateName}) {
    return function(accumulator) {
        const patch = accumulator['DeploymentTemplate'][deploymentTemplateName]
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
        const blueprint = Object.keys(accumulator['ApplicationBlueprint'])[0]
        const patch = accumulator['ApplicationBlueprint'][blueprint]
        patch.deploymentTemplates.push(templateName)
        return [ {typename: 'ApplicationBlueprint', target: blueprint, patch} ]
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
            properties = Object.values(resourceType.inputsSchema.properties || {}).map(inProp => ({name: inProp.title, value: inProp.default ?? null}))
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
    patches: {}
}

const getters = {
    getPreparedMutations(state) { return state.preparedMutations },
    getAccumulator(state) { return state.accumulator },
    getPatches(state) { return state.patches },
    hasPreparedMutations(state) { return state.preparedMutations.length > 0 }
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
            const {typename, target, patch} = patchDefinition
            if(!state.accumulator[typename]) state.accumulator[typename] = {}
            if(!state.patches[typename]) state.patches[typename] = {}

            state.patches[typename][target] = patch
            state.accumulator[typename][target] = patch
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
        if(!o?.dryRun) {
            state.path = undefined
            state.projectPath = undefined
        }
    },
    setBaseState(state, baseState) {
        state.accumulator = baseState
    },
    clearPreparedMutations(state) {
        state.preparedMutations = []
    }
}


const actions = {
    async fetchRoot({commit, rootState}) {
        const query = gql`
            query GetTemplateStateBeforeUpdating($fullPath: ID!) {
                applicationBlueprintProject(fullPath: $fullPath, dehydrated: true) @client
            }
        `
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
            fullPath: state.projectPath || rootState.project.globalVars.projectPath, 
            patch, 
            path: state.path || userDefaultPath()
        }

        if(o?.dryRun) {
            console.log(variables)
        }
        await graphqlClient.clients.defaultClient.mutate({
            mutation: UpdateDeploymentObject,
            variables
        })

    },

    async commitPreparedMutations({state, dispatch, commit}, o) {
        let dryRun = o?.dryRun
        await dispatch('fetchRoot')
        commit('applyMutations', {dryRun})
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
