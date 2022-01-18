import GraphQLJSON from 'graphql-type-json'
import _ from 'lodash';

export default {
  JSON: GraphQLJSON,

  Query: {
    
    // XXX unused, delete
    accounts: (root, args, { db }) => db.get('accounts').value(),

    applicationBlueprint: (root, args, { db }) => {
        //   'The full path of the project, group or namespace, e.g., `gitlab-org/gitlab-foss`.'
        // demo/apostrophe-demo
        return db.get('projects').value()[args.fullPath]
    },

    environments: (root, args, { db }) => {
      const namespace = args.namespace;
      const name = args.name;
      const userdata = db.get('users').value()[namespace];
      let environments = [];
      if (userdata) {
        environments = userdata.environments;
        if (environments) {
          if (name) {
            environments = _.filter(environments, { name });
          }
        }
      }
      return {
        namespace,
        name,
        clientPayload: environments
      }
    },

    resourceTemplates: (root, args, { db }) => {
      // (namespace: String): => ResourceTemplates
    },
  },

  // fields with JSON type need explicit resolvers
  ApplicationBlueprintProject: {
    json: (obj, args, { }) => obj
  }, 
 
  Environments: {
    clientPayload: (obj, args, { }) => obj
  },

  ResourceTemplates: {
    clientPayload: (obj, args, { }) => obj
  },

  Mutation: {

    updateTemplateResource: (root, { input }, { pubsub, db }) => {
      const { projectPath, title, resourceObject } = input; 
      const overview = db.get('projects').value()[projectPath];      
      const index = _.findIndex(overview['templates'], { title });
      overview['templates'][index]['resource_templates'] = resourceObject;
      db.write();
      return {
          isOk: true,
          resourceObject,
          errors: []
      }
     },
  
    createTemplate: (root, { input }, { pubsub, db }) => { 
      const { projectPath, template } = input;
      const overview = db.get('projects').value()[projectPath];
      const newTemplate = { ...template };
      newTemplate.resource_templates = template.resourceTemplates;
      delete newTemplate.resourceTemplates;
      overview.templates.push(newTemplate);
      db.write();
      return overview.templates;
    },

    removeTemplate: (root, { input }, { pubsub, db }) => {
      const { projectPath, title } = input;
      const overview = db.get('projects').value()[projectPath];
      _.remove(overview['templates'], { title });          
      db.write();
      return  {
        isOk: true,
        templates: overview["templates"]
      }
    },

  /*
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
*/
  },

  Subscription: {
  },
}
