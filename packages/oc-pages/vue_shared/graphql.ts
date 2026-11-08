import { ApolloLink } from '@apollo/client/core';
import { visit } from 'graphql/language';
import type { ASTNode, FragmentDefinitionNode } from 'graphql/language';

interface FragmentUse {
    // the fragments whose definitions spread this one
    referencedByFragments: string[];
    // spread directly in an operation
    isTopLevel: boolean;
}

/**
 * Drops fragment definitions a query does not use, which the server rejects.
 * A workaround for apollo client issue https://github.com/apollographql/apollo-client/issues/5192,
 * adapted from https://github.com/apollographql/apollo-client/pull/5201.
 * The fork's graphql_shim prepends it to every query.
 */
export const link = new ApolloLink((operation, forward) => {
    const fragmentSpreads: Record<string, FragmentUse> = {};

    visit(operation.query, {
        FragmentSpread: {
            enter(node, key, parent, path, ancestors) {
                if (!fragmentSpreads[node.name.value]) {
                    fragmentSpreads[node.name.value] = {
                        referencedByFragments: [],
                        isTopLevel: false,
                    };
                }
                const definition = ancestors[2] as ASTNode;
                if (definition.kind === 'FragmentDefinition') {
                    fragmentSpreads[node.name.value].referencedByFragments.push((definition as FragmentDefinitionNode).name.value);
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
