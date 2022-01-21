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

function makeClientResolver(typename, field=null, selector) {
    return (root, variables, context, info) => {
        // query must retrieve the json field
        console.log(context.jsondb, root)
        const json = field !== null ? context.jsondb[field]: context.jsondb;
        let target
        try {
            target = json[typename]
        } catch {
            console.error(typename, json)
            throw new Error('Cannot use constructed client resolver')
        }
        target.__typename = typename; // ensure __typename
        //context.jsondb = json;
        return typeof(selector) == 'function'? selector(target, root, variables, context, info): target;
    }
}

function makeObjectLookupResolver(typename) {
  return (parent, args, { cache, jsondb }, info) => {
      const obj = jsondb[typename][ parent [ info.field.name.value] ];
      if (obj) {
          obj.__typename = typename; // ensure __typename
      }
      return obj ?? null;
  }
} 

function listMakeObjectLookupResolver(typename) {
    return (parent, args, {cache, jsondb}, info) => {
        const result = []
        for(const itemKey of parent[info.field.name.value]) {
            const item = jsondb[typename][itemKey]
            if(item) {
                item.__typename = typename
            }
            result.push(item)
        }
        return result
    }
}


export const resolvers = {

    ApplicationBlueprintProject: {
        overview: makeClientResolver('Overview'),
        applicationBlueprint: makeClientResolver('ApplicationBlueprint', null, (target) => {
            return Object.values(target)[0] // TODO take slug
        })
    },

    Environments: {
      environments: makeClientResolver('DeploymentEnvironment', 'clientPayload')
    },

    ResourceTemplates: {
      resourceTemplates: makeClientResolver('ResourceTemplate', 'clientPayload')      
    },

    ApplicationBlueprint: {
        primary: makeObjectLookupResolver('ResourceType'),
        // TODO implement filtering
        deploymentTemplates: listMakeObjectLookupResolver('DeploymentTemplate'),
        /*
        deploymentTemplates: (parent, args, { cache, jsondb }, { }) => {
            const templates = Object.values(jsondb['DeploymentTemplate']);
            if (args) {
                for (const key of Object.keys(args)) {
                    const lookup = args[key].substring("searchBy".length).toLowerCase();
                    const match = _.find(templates, { [lookup]: args[key] });
                    if (match) {
                        return [match];
                    } else {
                        return [];
                    }
                }
            }
            return templates;
        },
        */
        overview: makeClientResolver('Overview'),

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
      name: (obj, args, { }) => obj.name ?? obj.title,
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
        async unfurlRoot(...args) {
            const json = await fetchRootBlob(...args) 
            args[2].fullPath = args[1].fullPath
            args[2].jsondb = json
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

        // TODO remove this
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
        // TODO remove this
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
    }
}
