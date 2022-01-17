import { ApolloLink } from 'apollo-link';
import { visit } from 'graphql/language';
import _ from "lodash";
import typeDefs from './graphql/client-schema.graphql';
import {getDeploymentTemplates, getResourceType, getResourceTemplate, getUnfurlRoot, getBlueprint} from './graphql/resolver-helpers.graphql'

export { typeDefs };

/**
 * This is a temporary workaround for apollo client issue https://github.com/apollographql/apollo-client/issues/5192
 * Adapted from the logic in https://github.com/apollographql/apollo-client/pull/5201
 */
export const link = new ApolloLink((operation, forward) => {
    const fragmentSpreads = {};

    visit(operation.query, {
        FragmentSpread: {
            enter(node, key, parent, path, ancestors) {
                if (!fragmentSpreads[node.name.value]) {
                    fragmentSpreads[node.name.value] = {
                        referencedByFragments: [],
                        isTopLevel: false,
                    };
                }
                if (ancestors[2].kind === 'FragmentDefinition') {
                    fragmentSpreads[node.name.value].referencedByFragments.push(ancestors[2].name.value);
                } else {
                    fragmentSpreads[node.name.value].isTopLevel = true;
                }
            },
        },
    });

    let shouldCheckAgain = true;
    while (shouldCheckAgain) {
        shouldCheckAgain = false;
        Object.keys(fragmentSpreads).forEach(key => {
            const fragmentSpread = fragmentSpreads[key];
            if (!fragmentSpread.isTopLevel) {
                const previousReferenceLength = fragmentSpread.referencedByFragments.length;
                fragmentSpread.referencedByFragments = fragmentSpread.referencedByFragments.filter(
                    referencedByKey =>
                        fragmentSpreads[referencedByKey] &&
                        (fragmentSpreads[referencedByKey].isTopLevel ||
                            fragmentSpreads[referencedByKey].referencedByFragments.length > 0),
                );
                if (previousReferenceLength !== 0 && fragmentSpread.referencedByFragments.length === 0) {
                    shouldCheckAgain = true;
                }
            }
        });
    }

    const transformedQuery = visit(operation.query, {
        FragmentDefinition: {
            enter(node) {
                const fragmentSpread = fragmentSpreads[node.name.value];
                if (
                    fragmentSpread == null ||
                    (!fragmentSpread.isTopLevel && fragmentSpread.referencedByFragments.length === 0)
                ) {
                    return null;
                }
                return undefined;
            },
        },
    });

    operation.query = transformedQuery;
    return forward(operation);
});

// annoyingly we need to add __typename manually when writing client-only resolvers
function patchTypenameInArr(typename, overview, args, ctx, info) {
    const arr = overview[info.field.name.value];
    if (!(arr && arr.forEach))
        return [];
    arr.forEach((elem) => { if(elem) elem.__typename = typename; });
    return arr;
}

function getProjectPath(root, variables, context) {
    return (
        (root && root.fullPath) ||
        (variables && variables.fullPath) || 
        //context.fullPath // NOTE this doesn't work
        location.pathname.split('/').slice(1,3).join('/') // TODO don't do this
    )
}

async function fetchRootBlob(root, _variables, context) {
    try {
        const {client} = context
        const variables = {fullPath: getProjectPath(root, _variables, context), fetchPolicy: _variables?.fetchPolicy}

        const {errors, data} = await client.query({
            query: getUnfurlRoot,
            variables,
            fetchPolicy: _variables?.fetchPolicy
        })
        if(errors) {
            errors.forEach(console.error)
        }
        const jsonPayload = data?.applicationBlueprint?.json
        return _.cloneDeep(jsonPayload)
    } catch(e) {
        console.error(e)
    }

}

async function fetchResourceType(variables, context){
    try {
        const {client} = context
        if (!variables.name) {throw new Error('Cannot map resource type without a name.')}
        const {errors, data} = await client.query({
            query: getResourceType,
            variables: {...variables, fullPath: getProjectPath(null, variables, context)}
        })
        if(errors) {errors.forEach(console.error)}
        //if(data === null) return null
        if(data === null) {
            const name = `Unresolved Resource Type: ${variables.name}`
            return {
                __typename: 'ResourceType',
                name: name,
                title: name,
                badge: 'ERR',
                description: null,
                properties: [],
                outputs: [],
                requirements: [],
            }
        }
        if(!data) return null
        const {resourceType} = data
        if(!resourceType) return null
        resourceType.__typename = 'ResourceType'
        return resourceType
    } catch(e) {
        console.error(e)
    }
}

async function fetchResourceTemplate(variables, context){
    try {
        const {client} = context
        if (!variables.name) {throw new Error('Cannot map resource template without a name.')}
        const {errors, data} = await client.query({
            query: getResourceTemplate,
            errorPolicy: 'all',
            variables: {...variables, fullPath: getProjectPath(null, variables, context)}
        })
        if(errors) {errors.forEach(console.error)}
        if(!data) return null
        const {resourceTemplate} = data
        if(!resourceTemplate) return null
        resourceTemplate.__typename = 'ResourceTemplate'
        return resourceTemplate
    }
    catch(e) {
        console.error(e)
    }
}

async function fetchDeploymentTemplates(variables, context) {
    try {
        const {client} = context
        const fullPath = getProjectPath(null, variables, context)
        const {errors, data} = await client.query({
            query: getDeploymentTemplates,
            variables: {...variables, fullPath}
        })
        //context.fullPath = fullPath // NOTE this doesn't work
        if(errors) {errors.forEach(console.error)}
        const deploymentTemplates = data.deploymentTemplates.map(dt => {
            if(!dt) return null
            dt.__typename = "DeploymentTemplate"
            dt.name = dt.slug
            return dt
        })
        return deploymentTemplates
    } catch(e) {
        console.error(e)
    }
}

async function fetchOverview(variables, context) {
    try {
        const {client} = context
        const {errors, data} = await client.query({
            query: getOverview,
            variables: {...variables, fullPath: getProjectPath(null, variables, context)}
        })

        if(errors) {errors.forEach(console.error)}
        const {overview} = data
        return overview
    }
    catch(e) {
        console.error(e)
    }
}

async function fetchApplicationBlueprint(variables, context) {
    try {
        const {client} = context
        const {errors, data} = await client.query({
            query: getBlueprint,
            variables: {...variables, fullPath: getProjectPath(null, variables, context)}
        })
        if(errors) {errors.forEach(console.error)}
        const {newApplicationBlueprint} = data

        return newApplicationBlueprint
    }
    catch(e) {
        console.error(e)
    }
}

function missingResolverVariableError(missingField, args) {
    const [parent, _1, _2, info] = args
    const e = `Cannot get ${info.field.name.value} without '${missingField}' in ${parent && parent.__typename}`
    console.error(e)
    return new Error(`Cannot get ${info.field.name.value} without '${missingField}' in ${parent && parent.__typename}`)
}

function clientResolverError(e, baseMessage) {
    const _e = `${baseMessage}: ${e.message}`
    console.error(_e)
    return new Error(_e)
}

export const resolvers = {

    ApplicationBlueprintProject: {
        overview: (root, variables, { cache }, info) => {
            // query must retrieve the json field
            root.json.__typename = 'Overview';
            return root.json;
        }
    },

    Query: {
        blueprintRaw: async (...args) => {
            try {
                const {ApplicationBlueprint} = await fetchRootBlob(...args)
                const variables = args[1]
                const result = variables.name?
                    ApplicationBlueprint[variables.name] :
                    Object.values(ApplicationBlueprint)[0]
                if(!result) throw new Error(`ApplicationBlueprint ${variables.name} not found`)
                result.__typename = 'JSON'
                return result
            } catch(e) {
                throw new clientResolverError(e,'Could not fetch application blueprint JSON')
            }
        },
        resourceTemplateRaw: async (...args) => {
            try {
                const {ResourceTemplate} = await fetchRootBlob(...args)
                const variables = args[1]
                const result = ResourceTemplate[variables.name]
                if(!result) throw new Error(`ResourceTemplate ${variables.name} not found`)
                result.__typename = 'JSON'
                return result
            } catch(e) {
                throw new clientResolverError(e,'Could not fetch resource template JSON')
            }
        },
        deploymentTemplateRaw: async (...args) => {
            try { 
                const {DeploymentTemplate} = await fetchRootBlob(...args)
                const variables = args[1]
                const result = DeploymentTemplate[variables.name]
                if(!result) throw new Error(`DeploymentTemplate ${variables.name} not found`)
                result.__typename = 'JSON'
                return result
            } catch(e) {
                throw new clientResolverError(e,'Could not fetch resource template JSON')
            }
        },
        newApplicationBlueprint: async (...args) => {
            const {ApplicationBlueprint, Overview} = await fetchRootBlob(...args)
            const variables = args[1]
            const target = variables.name?
                ApplicationBlueprint[variables.name] :
                Object.values(ApplicationBlueprint)[0]
            const result = {...target}

            const {livePreview, sourceCodeUrl} = Overview
            Object.assign(result, variables, {livePreview, sourceCodeUrl}) // propogate fullPath?
            result.overview = Overview
            result.overview.__typename = 'Overview'
            return result
        },
        resourceType: async (...args) => {
            const {ResourceType} = await fetchRootBlob(...args)
            let name
            try { name = args[1].name }
            catch(e) { throw missingResolverVariableError('name', args) }
            const result = ResourceType[name]
            if(!result) return
            result.__typename = 'ResourceType'
            return result
        },
        resourceTemplate: async (...args) => {
            const {ResourceTemplate} = await fetchRootBlob(...args)
            let name
            try { name = args[1].name }
            catch(e) { throw missingResolverVariableError('name', args) }
            const result = ResourceTemplate[name]
            if(!result) return
            result.__typename = 'ResourceTemplate'
            return result

        },
        deploymentTemplates: async (...args) => {
            const {deploymentTemplates} = args[1]
            const {DeploymentTemplate} = await fetchRootBlob(...args)
            const result = []
            for(const deploymentKey of deploymentTemplates) {
                result.push(DeploymentTemplate[deploymentKey])
            }
            return result
        },
        overview: async (...args) => {
            const {Overview} = await fetchRootBlob(...args)
            return Overview
        },

        async ResourceType(...args) {
            const {ResourceType} = await fetchRootBlob(...args) // NOTE I guess I need to be able to do this for globally defined resources even when there may be no full path
            for(const rt of Object.values(ResourceType)) {if (rt) rt.__typename = 'ResourceType'}
            return Object.values(ResourceType)
        }
    },

    ApplicationBlueprint: {
        primary(parent, _, context) {
            const variables = {name: parent.primary, fullPath: parent.fullPath}
            return fetchResourceType(variables, context)

        },
        async deploymentTemplates(parent, vars, context) {
            const {fullPath, deploymentTemplates} = parent
            // TODO add search by title
            const variables = {fullPath, deploymentTemplates: deploymentTemplates}
            let result = await fetchDeploymentTemplates(variables, context)
            if(vars) {
                
                /*
                result = result.filter(deploymentTemplate => {
                    if(vars.searchBySlug) {
                        return deploymentTemplate.slug == vars.searchBySlug
                    } else if (vars.searchByTitle) {
                        return deploymentTeplmate.title == vars.searchByTitle
                    }
                    return true
                })
                
                */
                /*
                result = result.map(deploymentTemplate => {
                    let keep = true
                    if(vars.searchBySlug) {
                        keep = deploymentTemplate.slug == vars.searchBySlug
                    } else if (vars.searchByTitle) {
                        keep = deploymentTeplmate.title == vars.searchByTitle
                    }
                    if(keep) return deploymentTemplate
                    else return null
                })
                */

            }

            return result
        },


    },

    ResourceTemplate: {
        type(parent, _, context) {
            const variables = {name: parent.type, fullPath: parent.fullPath}
            return fetchResourceType(variables, context)
        },
        name: (obj, args, { }) => (obj && obj.name) ?? null,
        dependencies: _.partial(patchTypenameInArr, "Dependency"),
        properties: _.partial(patchTypenameInArr, "Input"),
        description: (obj, args, { }) => (obj && obj.descriptio) ?? null,
        outputs: (obj, args, { }) => (obj && obj.outputs) ?? [],
    },

    ResourceType: {
        name: (obj, args, { }) => (obj && obj.name) ?? null,
        badge: (obj, args, { }) => (obj && obj.badge) ?? null,
        description: (obj, args, { }) => (obj && obj.description) ?? null,
        requirements: _.partial(patchTypenameInArr, "RequirementConstraint"), // NOTE we cannot remove null, unresolved requirement names here, because the resolution has not been done yet
        properties: _.partial(patchTypenameInArr, "Input"),
        outputs: _.partial(patchTypenameInArr, "Output")


    },

    DeploymentTemplate: {
        cloud: (obj, args, { }) => (obj && obj.cloud) ?? null,
        blueprint(parent, _, context) {
            const variables = {name: parent.blueprint, fullPath: parent.fullPath}
            return fetchApplicationBlueprint(variables, context) 
        },
        resourceTemplates(parent, _, context) {
            const subRequests = parent.resourceTemplates.map(name => {
                const variables = {name, fullPath: parent.fullPath}
                return fetchResourceTemplate(variables, context)
            })
            return Promise.all(subRequests)
        },

        primary(parent, _, context) {
            const variables = {name: parent.primary, fullPath: parent.fullPath}
            return fetchResourceTemplate(variables, context)
        },


/*
description: String

  blueprint: ApplicationBlueprint!

  """
  Required cloud provider

  TODO: should be ResourceType
  """
  cloud: String

  """
  Slug of template
  """
  slug: String!

  """
  Title of template
  """
  title: String!

  primary: ResourceTemplate!

  resourceTemplates: [ResourceTemplate!]

*/

    },

    RequirementConstraint: {
        resourceType(parent, _, context) {
            if(!parent) return
            const variables = {name: parent.resourceType, fullPath: parent.fullPath}
            return fetchResourceType(variables, context)
        }
        
    },

    Dependency: {
        title: (obj, args, { }) => (obj && obj.title) ?? null,
        constraint(parent, _, context) {
            return {...parent.constraint, __typename: 'RequirementConstraint'}
        },

        match(parent, _, context) {
            if(!parent.match) return null
            const variables = {name: parent.match, fullPath: parent.fullPath}
            return fetchResourceTemplate(variables, context)
        }
        
    },


    Overview: {

        title: (obj, args, { }) => (obj && obj.title) ?? null,
        name: (obj, args, { }) => (obj && obj.name) ?? null,
        id: (obj, args, { }) => (obj && obj.id) ?? null,
        description: (obj, args, { }) => (obj && obj.description) ?? null,

        inputs: _.partial(patchTypenameInArr, "Input"),

        outputs: _.partial(patchTypenameInArr, "Output"),

        requirements: _.partial(patchTypenameInArr, "OldRequirement"),
      
        resources: _.partial(patchTypenameInArr, "OldResource"),

        servicesToConnect: _.partial(patchTypenameInArr, "ServiceToConnect"),
        
        environments: _.partial(patchTypenameInArr, "OcEnvironment"),

        templates: (overview, args, { }) => {
            if (args) {
                for (const key in Object.keys(args)) {
                    // one of searchByType, searchBySlug, searchByTitle, strip "searchBy"
                    const lookup = args[0].substring("searchBy".length).toLowerCase();
                    const match = _.find(overview.templates, { [lookup]: args[key] });
                    if (match) {
                        match.__typename = 'Template';
                        return [match];
                    } else {
                        return [];
                    }
                }
            }
            overview.templates.forEach((elem) => { elem.__typename = 'Template'; });
            return overview.templates
        }
      },

    OldRequirement: {
        inputs: _.partial(patchTypenameInArr, "Input"),

        outputs: _.partial(patchTypenameInArr, "Output"),

        requirements: _.partial(patchTypenameInArr, "OldRequirement"),

        status: (obj, args, { }) => obj.status ?? null,
    },

    // note: fields with JSON type need explicit resolvers

  Input: {
      instructions: (obj, args, { }) => obj.instructions ?? obj.description ?? null,

      title: (obj, args, { }) => obj.title,

      // type JSON
      value: (obj, args, { }) => obj.value ?? null,

      // type JSON
      default: (obj, args, { }) => obj.default ?? null,

      required: (obj, args, { }) => obj.required ?? false,

      // type JSON
    schema: (obj, args, { }) => {
        // return self, add minimal json-schema definition if missing
        if (!obj.type) ob.type = "string";
        return obj;
      },
    },

    Template: {
        // type JSON
        resourceTemplates: (template, args, {}) => template.resource_templates,
    
        // type Int
        totalDeployments: (template, args, {}) => template.total_deployments,     
    },

    OldResource: {
        inputs: _.partial(patchTypenameInArr, "Input"),

        // type JSON
        requirements: (resource, args, {}) => resource.requirements
    },    
}
