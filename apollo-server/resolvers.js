import GraphQLJSON from 'graphql-type-json'
import _ from 'lodash';

export default {
  JSON: GraphQLJSON,

  Query: {
    
    accounts: (root, args, { db }) => db.get('accounts').value(),

    applicationBlueprint: (root, args, { db }) => {
        //   'The full path of the project, group or namespace, e.g., `gitlab-org/gitlab-foss`.'
        // demo/apostrophe-demo
        return db.get('projects').value()[args.fullPath]
    }
  },

  // fields with JSON type need explicit resolvers
  ApplicationBlueprint: {
    json: (obj, args, { }) => obj
  },    
  
  Mutation: {
    /*
    myMutation: (root, args, context) => {
      const message = 'My mutation completed!'
      context.pubsub.publish('hey', { mySub: message })
      return message
    },
    addMessage: (root, { input }, { pubsub, db }) => {
      const message = {
        id: shortid.generate(),
        text: input.text
      }

      db
        .get('messages')
        .push(message)
        .last()
        .write()

      pubsub.publish('messages', { messageAdded: message })

      return message
    },
    addAccount: ( root, { input }, { pubsub, db }) => {
      const account = {
        id: shortid.generate(),
        account: input.account,
        network: input.network,
        group: input.group,
        resource: input.resource,
        service: input.service,
        emsemble: input.emsemble,
        description: input.description
      }

      db
        .get('accounts')
        .push(account)
        .last()
        .write()

      return account;
    },

    singleUpload: (root, { file }, { processUpload }) => processUpload(file),
    multipleUpload: (root, { files }, { processUpload }) => Promise.all(files.map(processUpload)),
*/
  },

  Subscription: {
    /*
    mySub: {
      subscribe: (parent, args, { pubsub }) => pubsub.asyncIterator('hey'),
    },
    counter: {
      subscribe: (parent, args, { pubsub }) => {
        const channel = Math.random().toString(36).substring(2, 15) // random channel name
        let count = 0
        setInterval(() => pubsub.publish(
          channel,
          {
            // eslint-disable-next-line no-plusplus
            counter: { count: count++ },
          }
        ), 2000)
        return pubsub.asyncIterator(channel)
      },
    },

    messageAdded: {
      subscribe: (parent, args, { pubsub }) => pubsub.asyncIterator('messages'),
    },
  */
  },
}
