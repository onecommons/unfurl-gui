import { createProvider } from "../../vue-apollo";
import 'regenerator-runtime/runtime';
// import { resolvers, link, typeDefs } from "oc_pages/vue_shared/graphql";
// const apolloProvider = createProvider({resolvers, link, typeDefs});
let apolloProvider = null

// #!if false
apolloProvider = createProvider();
// #!endif

export default apolloProvider;
