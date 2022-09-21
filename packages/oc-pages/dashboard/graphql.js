import apolloProvider from "oc/graphql-shim.js";
import { CachePersistor } from 'apollo-cache-persist';
export default apolloProvider;

const cache = apolloProvider.defaultClient.cache
export const cachePersistor = new CachePersistor({
    cache,
    key: `apollo-cache-persist-${window.gon.current_user_id}`,
    storage: window.localStorage,
    debug: true,
    maxSize: false
})
