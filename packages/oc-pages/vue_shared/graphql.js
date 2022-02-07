import { ApolloLink } from 'apollo-link';
import { visit } from 'graphql/language';
import _ from "lodash";
import typeDefs from './graphql/client-schema.graphql';
import gql from 'graphql-tag'

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
    arr.forEach((elem) => { 
        if(typeof(elem) == 'object') elem.__typename = typename; 
        else {
            throw new Error(`Expected element '${JSON.stringify(elem)}' to be an object representing type '${typename}' in field '${info.field.name.value}' of '${overview.__typename}'`)
        }
    });
    return arr;
}

function getProjectPath(root, variables, context) {
    return (
        (root && root.fullPath) ||
        (variables && variables.fullPath) || 
        //context.fullPath
        location.pathname.split('/').slice(1,3).join('/') // TODO don't do this
    )
}

async function fetchRootBlob(root, _variables, context) {
    try {
        const {client} = context
        const variables = {..._variables, fullPath: getProjectPath(root, _variables, context), fetchPolicy: _variables?.fetchPolicy}

        const query = gql`
            query getApplicationBlueprintProject($fullPath: ID!) {
                applicationBlueprint(fullPath: $fullPath)  {
                    json
                }      
            }
        `

        const {errors, data} = await client.query({
            query,
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

function resolutionError(itemKey, typename, parent) {
  return new Error(`could not resolve key '${itemKey}' of type '${typename}' belonging to ${parent?.name}: ${parent.__typename}`)
}

// TODO pack everything after field into options
function makeClientResolver(typename, field=null, selector, indexTypename=true, setContext=true) {
    return (root, variables, context, info) => {
        // query must retrieve the json field
        let target = root
        if(!context.jsondb && setContext) context.jsondb = root
        if(variables?.dehydrated) {context.dehydrated = true}
        if(field !== null) {
            target = target = target[field]
        }
        if(indexTypename) {
            try {
                target = target[typename]
            } catch {
                console.error({typename, target, root})
                throw new Error('Cannot use constructed client resolver')
            }
        }
        //context.jsondb = json;
        if(!target) return null
        target = (typeof(selector) == 'function'? selector(target, root, variables, context, info): target)
        if(Array.isArray(target)) target.forEach(t => {if(t) {t.__typename = typename}})
        else target.__typename = typename; // ensure __typename
        return target
    }
}

function makeObjectLookupResolver(typename) {
  return (parent, args, { cache, jsondb, dehydrated }, info) => {
      if (dehydrated) return  parent [info.field.name.value] 
      const obj = jsondb[typename][ parent [ info.field.name.value] ];
      if (obj) {
          obj.__typename = typename; // ensure __typename
      } else {
          throw resolutionError(itemKey, typename, parent)
      }
      return obj ?? null;
  }
} 

function listMakeObjectLookupResolver(typename) {
    return (parent, args, {cache, jsondb, dehydrated}, info) => {
        const result = []
        //if(!parent[info.field.name.value]) {
            //throw new Error(`Could not lookup ${info.field.name.value} to resolve list of ${typename} in ${parent.name}: ${parent.__typename}`)

        let items = parent[info.field.name.value]
        if(!Array.isArray(items)) {
            console.error(`items is not an array ${items}`)
            items = []
        }
        for(const itemKey of items) {
            if(dehydrated) return itemKey
            const item = jsondb[typename][itemKey]
            if(item) {
                item.__typename = typename
            } else {
                throw resolutionError(itemKey, typename, parent)
            }
            result.push(item)
        }
        return result
    }
}


export const resolvers = {

    ApplicationBlueprintProject: {
        applicationBlueprint: makeClientResolver('ApplicationBlueprint', 'json', (target) => {
            return Object.values(target)[0] // TODO take slug
        }),
        ResourceType: makeClientResolver('ResourceType', 'json'),
        ApplicationBlueprint: makeClientResolver('ApplicationBlueprint', 'json'),
        ResourceTemplate: makeClientResolver('ResourceTemplate', 'json'),
        DeploymentTemplate: makeClientResolver('DeploymentTemplate', 'json'),
    },
  
    Environment: {
      deploymentEnvironment: makeClientResolver('DeploymentEnvironment', 'clientPayload', null, false, false)
    },

    DeploymentEnvironment: {
        connections: (parent, args, { cache, jsondb, dehydrated }, info) => {
            if(dehydrated) return Object.keys(parent.connections)
            const resourceTemplates = Object.values(parent.connections);
            resourceTemplates.forEach((elem) => {
                if(elem) elem.__typename = 'ResourceTemplate';
            });

            return resourceTemplates
        },

        primary_provider: (parent, args, { cache, jsondb, dehydrated }, info) => {
            const pp = parent.connections.primary_provider;
            if(dehydrated) return pp?.name
            if (pp) {
                pp.__typename = 'ResourceTemplate';
            }
            return pp || null;
        },

        cloud: (parent) => parent && (parent.cloud || parent.primary_provider || ''),
        deployments: (parent) => parent && (parent.deployments || [])
    },
    
    
    ResourceTemplates: {
      resourceTemplates: makeClientResolver('ResourceTemplate', 'clientPayload')      
    },

    ApplicationBlueprint: {
        primary: makeObjectLookupResolver('ResourceType'),
        // TODO implement filtering
        deploymentTemplates: listMakeObjectLookupResolver('DeploymentTemplate'),
        image: (obj) => obj.image ?? null,
        description: (obj) => obj.description ?? null
        //overview: makeClientResolver('Overview'),

    },
    /*
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
    */
    DeploymentTemplate: {
        cloud: (obj, args, { }) => (obj && obj.cloud) ?? null,
        blueprint: makeObjectLookupResolver('ApplicationBlueprint'),
        primary: makeObjectLookupResolver('ResourceTemplate'),

        resourceTemplates: listMakeObjectLookupResolver('ResourceTemplate')

    },

    ResourceType: {
        name: (obj, args, { }) => (obj && obj.name) ?? null,
        badge: (obj, args, { }) => (obj && obj.badge) ?? null,
        description: (obj, args, { }) => (obj && obj.description) ?? null,
        requirements: _.partial(patchTypenameInArr, "RequirementConstraint"), // NOTE we cannot remove null, unresolved requirement names here, because the resolution has not been done yet
        //properties: _.partial(patchTypenameInArr, "Input"),
        inputsSchema: (obj) => {
            const schema = (obj && obj.inputsSchema) ?? {}
            schema.__typename = 'JSON'
            return schema
        },
        outputsSchema: (obj) => {
            const schema = (obj && obj.outputsSchema) ?? {}
            schema.__typename = 'JSON'
            return schema
        },
        outputs: _.partial(patchTypenameInArr, "Output")
    },

    ResourceTemplate: {
        type: makeObjectLookupResolver('ResourceType'),
        name: (obj, args, { }) => (obj && obj.name) ?? null,
        dependencies: _.partial(patchTypenameInArr, "Dependency"),
        properties: _.partial(patchTypenameInArr, "Input"),
        description: (obj, args, { }) => (obj && obj.description) ?? null,
        outputs: (obj, args, { }) => (obj && obj.outputs) ?? [],
    },



    RequirementConstraint: {
        resourceType: makeObjectLookupResolver('ResourceType')
    },

    Input: {
        //instructions: (obj, args, { }) => obj.instructions ?? obj.description ?? null,
      name: (obj, args, { }) => obj && (obj.name ?? obj.title),
      //title: (obj, args, { }) => obj.title ?? obj.name,

      // type JSON
      value: (obj, args, { }) => obj.value ?? null,

      // type JSON
      //default: (obj, args, { }) => obj.default ?? null,

      //required: (obj, args, { }) => obj.required ?? false,
    },

    Dependency: {
        title: (obj, args, { }) => (obj && obj.title) ?? null,
        constraint(parent, _, context) {
            return {...parent.constraint, __typename: 'RequirementConstraint'}
        },

        match: makeObjectLookupResolver('ResourceTemplate')

    },


    Query: {
        async applicationBlueprintProject(...args) {
            const json = await fetchRootBlob(...args) 
            args[2].fullPath = args[1].fullPath
            args[2].jsondb = json
            args[2].dehydrated = args[1].dehydrated
            return {json, __typename: 'ApplicationBlueprintProject'}
        },
    
        async ResourceType(...args) {
            const {ResourceType} = await fetchRootBlob(...args) // NOTE I guess I need to be able to do this for globally defined resources even when there may be no full path
            for(const rt of Object.values(ResourceType)) {if (rt) rt.__typename = 'ResourceType'}
            return Object.values(ResourceType)
        },

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
    }
}
