import { createProvider } from "../../vue-apollo";
import { resolvers, link, typeDefs } from "oc_pages/vue_shared/graphql";
const apolloProvider = createProvider({resolvers, link, typeDefs});
export default apolloProvider;
