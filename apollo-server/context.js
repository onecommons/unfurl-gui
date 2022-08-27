import { processUpload } from './utils/upload'
const db = {};

// Context passed to all resolvers (third argument)
// req => Query
// connection => Subscription
// eslint-disable-next-line no-unused-vars
export default ({ req, connection }) => {
  return {
    db,
    processUpload,

  }
}
