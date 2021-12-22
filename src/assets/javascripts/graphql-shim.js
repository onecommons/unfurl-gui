import { createProvider } from "../../vue-apollo";
import { resolvers, link } from "oc/vue_shared/graphql";
const apolloProvider = createProvider({resolvers, link});
export default apolloProvider;
