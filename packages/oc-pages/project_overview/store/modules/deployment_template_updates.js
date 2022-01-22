import { cloneDeep } from 'lodash';
import { __ } from "~/locale";
import graphqlClient from '../../graphql';
import gql from 'graphql-tag';
import {slugify} from '../../../vue_shared/util'
import {getUnfurlRoot} from '../../../vue_shared/graphql/resolver-helpers.graphql'
import {UpdateDeploymentObject} from  '../../graphql/mutations/update_deployment_object.graphql'

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

export function appendResourceTemplateInDT({templateName, deploymentTemplateSlug}) {
    return function(accumulator) {
        const patch = accumulator['DeploymentTemplate'][deploymentTemplateSlug]
        patch.resourceTemplates.push(templateName)
        return [ {typename: 'DeploymentTemplate', target: deploymentTemplateSlug, patch} ]
    }
}

export function deleteResourceTemplateInDT({templateName, deploymentTemplateSlug}) {
    return function(accumulator) {
        const patch = accumulator['DeploymentTemplate'][deploymentTemplateSlug]
        const index = patch.resourceTemplates.indexOf(templateName)
        if(index != -1) patch.resourceTemplates.splice(index, 1)
        return [ {typename: 'DeploymentTemplate', target: deploymentTemplateSlug, patch} ]
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

export function deleteResourceTemplate({templateName, deploymentTemplateSlug}) {
    return function(accumulator) {
        const patch = null
        const result = [ {typename: 'ResourceTemplate', target: templateName, patch} ]
        if(deploymentTemplateSlug) { 
            result.push(
                deleteResourceTemplateInDT({templateName, deploymentTemplateSlug})(accumulator)[0]
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

export function deleteResourceTemplateInDependent({templateName, dependentName, dependentRequirement}) {
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

export function createResourceTemplate({type, name, title, description, deploymentTemplateSlug, dependentName, dependentRequirement}) {
    return function(accumulator) {
        const result = []

        if(deploymentTemplateSlug) {
            result.push(
                appendResourceTemplateInDT({templateName: name, deploymentTemplateSlug})(accumulator)[0]
            )
        }

        if(dependentName && dependentRequirement) {
            result.push(
                appendResourceTemplateInDependent({templateName: name, dependentName, dependentRequirement})(accumulator)[0]
            )
        }

        const resourceType = typeof(type) == 'string'? Object.values(accumulator['ResourceType']).find(rt => rt.name == type): type
        let properties 
        try {
            properties = Object.values(resourceType.inputsSchema.properties || {}).map(inProp => ({name: inProp.title, value: inProp.default ?? null}))
        } catch(e) { properties = [] }

        const dependencies = resourceType.requirements.map(req => ({
            constraint: req,
            match: null,
            target: null,
            name: req.name,
            __typename: 'Dependency'
        }))
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


export function createDeploymentTemplate({primary, primaryType, name, title, slug, description}) {
    console.warn('prepared createDeploymentTemplate is untested')
    return function(accumulator) {
        const result = []

        const type = primaryType//getters.getProjectInfo.primary.name

        const _slug = slug || name
        const _name = name || slug

        result.push(
            createResourceTemplate({type, name: slugify(primary), title: primary, description})(accumulator)[0]
        )

        result.push(
            appendDeploymentTemplateInBlueprint({templateName: _name})(accumulator)[0]
        )


        const patch = {
            primary: slugify(primary),
            name: _name,
            blueprint: getters.getProjectInfo.name,
            slug: _slug,
            description,
            title,
            __typename: "DeploymentTemplate",
            resourceTemplates: [slugify(primary)],
        }

        return [ {patch, target: name, typename: 'DeploymentTemplate'} ]
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
    pushPreparedMutation(state, preparedMutation) {
        state.preparedMutations.push(preparedMutation)
    },
    applyMutations(state) {
        for(const preparedMutation of state.preparedMutations) {
            for(const patchDefinition of preparedMutation(state.accumulator)){
                const {typename, target, patch} = patchDefinition

                if(!state.accumulator[typename]) state.accumulator[typename] = {}
                if(!state.patches[typename]) state.patches[typename] = {}

                state.patches[typename][target] = patch
                state.accumulator[typename][target] = patch
            }
        }
        state.preparedMutations = []
    },
    resetStagedChanges(state) {
        state.accumulator = {}
        state.patches = {}
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
        const {data, errors} = await graphqlClient.clients.defaultClient.query({
            query: getUnfurlRoot,
            variables: {fullPath: rootState.project.globalVars.projectPath}
        })

        commit('setBaseState', data?.applicationBlueprint?.json)
    },

    async sendUpdateSubrequests({getters, rootState}){

        for(let key in getters.getPatches) {
            const patch = getters.getPatches[key]
            graphqlClient.clients.defaultClient.mutate({
                mutation: UpdateDeploymentObject,
                variables: {fullPath: rootState.project.globalVars.projectPath, typename: key, patch}
            })
        }
    },

    async commitPreparedMutations({state, dispatch, commit}) {
        await dispatch('fetchRoot')
        commit('applyMutations')
        await dispatch('sendUpdateSubrequests')
        commit('resetStagedChanges')
    }
}

export default {
    state,
    mutations,
    actions,
    getters
}
