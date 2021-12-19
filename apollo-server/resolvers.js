import GraphQLJSON from 'graphql-type-json'
import shortid from 'shortid'
import _ from 'lodash';

export default {
  JSON: GraphQLJSON,

  Counter: {
    countStr: counter => `Current count: ${counter.count}`,
  },

  Query: {
    /*
    from boilerplate

    hello: (root, { name }) => `Hello ${name || 'World'}!`,
    messages: (root, args, { db }) => db.get('messages').value(),
    uploads: (root, args, { db }) => db.get('uploads').value(),
  */
    
    accounts: (root, args, { db }) => db.get('accounts').value(),
    overview: (root, args, { db }) => db.get('overview').value(),
  },

  Overview: {
    templates: (overview, args, { db }) => {
      if (args.searchBySlug) {
        return [_.find(overview.templates, { slug: args.searchBySlug })];
      }
      return overview.templates;
    }
  },

  Template: {
    resourceTemplates: (template, args, { db }) => template.resource_templates,
  
    totalDeployments: (template, args, { db }) => template.total_deployments,     
  },

  // fields with JSON type need explicit resolvers

  Resource: {
    requirements: (resource, args, { db }) => resource.requirements
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
