// regenerator's runtime is imported for its side effect, as it was when this
// module still built an Apollo provider.
import 'regenerator-runtime/runtime';

/*
 * The GraphQL client oc-pages queries through.
 *
 * The fork supplies its own copy of this module -- its `oc` alias points at
 * oc/app/assets/javascripts, where it keeps one of its own -- so this file only
 * ever serves standalone, which has no GitLab GraphQL endpoint and reaches no
 * query site.
 *
 * The contract is an ApolloClient, not a vue-apollo provider. Nothing in
 * oc-pages uses the `$apollo` component option, so a provider only existed to
 * be unwrapped again at every call site, and it would have needed a Vue 3 port
 * of vue-apollo in the fork to buy that.
 */
export default null
