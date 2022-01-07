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
    if (!arr)
        return [];
    arr.forEach((elem) => { elem.__typename = typename; });
    return arr;
}

function getProjectPath(root, variables, context) {
    return (
        (root && root.fullPath) ||
        (variables && variables.fullPath) || 
        location.pathname.split('/').slice(1,3).join('/') // TODO don't do this
    )
}

async function fetchRootBlob(root, _variables, context) {
    const {client} = context
    const variables = {fullPath: getProjectPath(root, _variables, context)}

    const {errors, data} = await client.query({
        query: getUnfurlRoot,
        variables
    })
    if(errors) {
        errors.forEach(console.error)
    }
    const {unfurlRootBlob} = data
    return unfurlRootBlob
}

async function fetchResourceType(variables, context){
    const {client} = context
    const {errors, data} = await client.query({
        query: getResourceType,
        variables: {...variables, fullPath: getProjectPath(null, variables, context)}
    })
    if(errors) {errors.forEach(console.error)}
    if(data === null) return null
    const {resourceType} = data
    resourceType.__typename = 'ResourceType'
    return resourceType
}

async function fetchResourceTemplate(variables, context){
    const {client} = context
    const {errors, data} = await client.query({
        query: getResourceTemplate,
        errorPolicy: 'all',
        variables: {...variables, fullPath: getProjectPath(null, variables, context)}
    })
    if(errors) {errors.forEach(console.error)}
    if(data === null) return null
    const {resourceTemplate} = data
    resourceTemplate.__typename = 'ResourceTemplate'
    return resourceTemplate
}

async function fetchDeploymentTemplates(variables, context) {
    const {client} = context
    const {errors, data} = await client.query({
        query: getDeploymentTemplates,
        variables: {...variables, fullPath: getProjectPath(null, variables, context)}
    })
    if(errors) {errors.forEach(console.error)}
    const deploymentTemplates = data.deploymentTemplates.map(dt => {
        dt.__typename = "DeploymentTemplate"
        dt.name = dt.slug
        return dt

    })
    return deploymentTemplates
}

async function fetchApplicationBlueprint(variables, context) {
    const {client} = context
    const {errors, data} = await client.query({
        query: getBlueprint,
        variables: {...variables, fullPath: getProjectPath(null, variables, context)}
    })
    if(errors) {errors.forEach(console.error)}
    const {newApplicationBlueprint} = data

    return newApplicationBlueprint
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
        newApplicationBlueprint: async (...args) => {
            const {ApplicationBlueprint} = await fetchRootBlob(...args)
            const variables = args[1]
            const result = variables.name?
                ApplicationBlueprint[variables.name] :
                Object.values(ApplicationBlueprint)[0]

            Object.assign(result, variables) // propogate fullPath
            return result
        },
        resourceType: async (...args) => {
            const {ResourceType} = await fetchRootBlob(...args)
            const {name} = args[1]
            const result = ResourceType[name]
            //result.fullPath = args[1].fullPath
            return result
        },
        resourceTemplate: async (...args) => {
            const {ResourceTemplate} = await fetchRootBlob(...args)
            const {name} = args[1]
            const result = ResourceTemplate[name]
            //result.fullPath = args[1].fullPath
            return result

        },
        deploymentTemplates: async (...args) => {
            const {deploymentTemplates} = args[1]
            const {DeploymentTemplate} = await fetchRootBlob(...args)
            const result = []
            for(const deploymentKey of deploymentTemplates) {
                result.push(DeploymentTemplate[deploymentKey])
            }
            //result.fullPath = args[1].fullPath
            return result
        }
    },

    ApplicationBlueprint: {
        primary(parent, _, context) {
            const variables = {name: parent.primary, fullPath: parent.fullPath}
            return fetchResourceType(variables, context)

        },
        deploymentTemplates(parent, _, context) {
            const {fullPath, deploymentTemplates} = parent
            const variables = {fullPath, deploymentTemplates}
            return fetchDeploymentTemplates(variables, context)
        },


    },

    ResourceTemplate: {
        type(parent, _, context) {
            const variables = {name: parent.type, fullPath: parent.fullPath}
            return fetchResourceType(variables, context)
        },
        name: (obj, args, { }) => (obj && obj.name) ?? null,
        requirements: _.partial(patchTypenameInArr, "RequirementConstraint"),
        properties: _.partial(patchTypenameInArr, "Input"),
    },

    ResourceType: {
        name: (obj, args, { }) => (obj && obj.name) ?? null,
        badge: (obj, args, { }) => (obj && obj.badge) ?? null,
        requirements: _.partial(patchTypenameInArr, "RequirementConstraint"),
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
            const variables = {name: parent.resourceType, fullPath: parent.fullPath}
            return fetchResourceType(variables, context)
        }
    },


    Overview: {

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
