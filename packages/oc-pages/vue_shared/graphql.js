import { ApolloLink } from 'apollo-link';
import { visit } from 'graphql/language';
import _ from "lodash";
import typeDefs from './graphql/client-schema.graphql';

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

function makeClientResolver(typename, field) {
  return (root, variables, { cache }, info) => {
      // query must retrieve the json field
      const json = root[field];
      json.__typename = typename;
      return json;
    }
}

export const resolvers = {

  ApplicationBlueprintProject: {
        overview: makeClientResolver('Overview', 'json'),
        applicationBlueprint: makeClientResolver('ApplicationBlueprint', 'json')
  },
  
  Environments: {
    environments: makeClientResolver('DeploymentEnvironment', 'clientPayload')
  },
  
  ResourceTemplates: {
    resourceTemplates: makeClientResolver('ResourceTemplate', 'clientPayload')      
  },
  
    Overview: {

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

    OldRequirement: {
        inputs: _.partial(patchTypenameInArr, "Input"),

        outputs: _.partial(patchTypenameInArr, "Output"),

        requirements: _.partial(patchTypenameInArr, "OldRequirement"),

        status: (obj, args, { }) => obj.status ?? null,
    },

    // note: fields with JSON type need explicit resolvers

  Input: {
      instructions: (obj, args, { }) => obj.instructions ?? obj.description,

      name: (obj, args, { }) => obj.name ?? obj.title,

      title: (obj, args, { }) => obj.title ?? obj.name,

      // type JSON
      value: (obj, args, { }) => obj.value ?? null,

      // type JSON
      default: (obj, args, { }) => obj.default ?? null,

      required: (obj, args, { }) => obj.required ?? false,
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
