import fs from 'fs'
import path from 'path'

const typeDefs = [
  fs.readFileSync(path.resolve(__dirname, './schema.graphql'), { encoding: 'utf8' }),
  fs.readFileSync(path.resolve(__dirname, './gitlab_schema.graphql'), { encoding: 'utf8' })
];

// we need to include the client schema when generating the schema json used by the `graphql/template-strings` eslinter plugin
if (process.env.APOLLO_SCHEMA_GENERATE) 
  typeDefs.push(fs.readFileSync(path.resolve(__dirname, '../src/gitlab-oc/vue_shared/graphql/client-schema.graphql'), { encoding: 'utf8' }))

export default typeDefs;
