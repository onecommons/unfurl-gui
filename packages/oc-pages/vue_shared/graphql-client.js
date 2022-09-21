import apolloProvider from "oc/graphql-shim.js";
import { CachePersistor } from 'apollo-cache-persist';
import * as localForage from 'localforage'
export default apolloProvider;

const cache = apolloProvider.defaultClient.cache

//const CACHE_SIZE = 2097152 // 2MB

localForage.config({
    driver: localForage.INDEXEDDB,
    name: 'graphql',
    version: 0.1,
    storeName: 'cache',
    description: 'store for graphql data'
})

export const cachePersistor = new CachePersistor({
    cache,
    key: `apollo-cache-persist-${window.gon.current_user_id}`,
    storage: localForage,
    debug: true,
    serialize: false,
    maxSize: false
})
