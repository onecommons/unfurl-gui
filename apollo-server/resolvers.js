import GraphQLJSON from 'graphql-type-json'
import _ from 'lodash';
import {readFileSync, readdirSync} from 'fs'
import {resolve, dirname} from 'path'
const username = process.env.UNFURL_CLOUD_USERNAME || "demo"

const apolloServerDir = resolve(dirname(import.meta.url.replace('file://', '')))
const REPOS_DIR = resolve(apolloServerDir, 'repos')

function findDeployment(deploymentAbsolute, db) {
  let ensembleJSONRaw 
  const files = db.get('files').value()
  const lowdbPath = deploymentAbsolute.slice(REPOS_DIR.length + 1) + '/deployment.json'
  const lowdbFile = files[lowdbPath]
  if(lowdbFile) return lowdbFile
  try {
      ensembleJSONRaw = readFileSync(resolve(deploymentAbsolute, 'ensemble.json'), 'utf-8')
  } catch(e) {}
  if(!ensembleJSONRaw) {
      try {
          ensembleJSONRaw = readFileSync(resolve(deploymentAbsolute, 'deployment.json'), 'utf-8')
      } catch (e) {
        return null;
      }
  }
  return JSON.parse(ensembleJSONRaw)
}

export default {
  JSON: GraphQLJSON,


  Query: {
  
    applicationBlueprint: (root, args, { db }) => {
        //   'The full path of the project, group or namespace, e.g., `gitlab-org/gitlab-foss`.'
        // demo/apostrophe-demo
        return db.get('projects').value()[args.fullPath]
    },

    project(root, args, context) {
      context.fullPath = args.fullPath
      return {__typename: 'Project'}
    },
  },

  Environment: {
    deployments: (root, args, { db, fullPath }) => {
      const projectPath = fullPath
      const environment = root;
      const environments = db.get('environments').value()[environment._project]
      if (!environments) {
        return [];
      }
      const deployment_paths = environments['DeploymentPath']
      // deployment_paths should look like:
      // {
      // <deployment-path>: {
      //        environment: <name>
      //   }
      // }
      const deployments = []      
      if (deployment_paths) {
        Object.entries(deployment_paths).forEach(([key, value]) => {
          const path = key;
          if (value['environment'] == environment.name) {
            const deploymentAbsolute = resolve(REPOS_DIR, projectPath, path)
            const deployment = findDeployment(deploymentAbsolute, db)
            if (deployment)
              deployments.push(deployment)
          }
        });        
      }
      return deployments
    }
  },

  Project: {
    userPermissions(root, args, context) {
      return {__typeName: 'ProjectPermissions'}
    },

    environments() {
      return {__typename: 'EnvironmentConnection'}
    }
  },

  EnvironmentConnection: {
    nodes(root, args, {db, fullPath}) {
      const namespace = root.fullPath || fullPath
      try {
        // get the environments associated with this project
        const environments = db.get('environments').value()[namespace]['DeploymentEnvironment']
        if (!environments) {
          return [];
        }
        const result = Object.entries(environments).map(([key, value]) => ({
            __typeName: 'Environment',
            path: key,
            name: key,
            state: 'available',
            clientPayload: value,
            _project: namespace
        }));
        return result
      } catch (e) {
          console.log(`bad environments: ${e}`);
          return [];
      }
    }
  },
  ProjectPermissions: {
    pushCode(root, args, context) {
      return context.fullPath.startsWith(username)
    }
  },

  // fields with JSON type need explicit resolvers
  ApplicationBlueprintProject: {
    json: (obj, args, { }) => obj
  }, 
 

  // ResourceTemplates: {
  //   clientPayload: (obj, args, { }) => obj
  // },

  Mutation: {

    /*
    deleteResourceTemplate: (root, {fullPath, name}, {db}) => {
      const projectRoot = db.get('projects').value()[fullPath]
      const {ResourceTemplate} = projectRoot
      const isOk  = delete ResourceTemplate[name]

      projectRoot.ResourceTemplate = ResourceTemplate
      db.write()
      return isOk? name: ''
    },
    */


    updateDeploymentObj(root, {input}, {db}) {
      const {projectPath, patch, path} = input
      const _path = path || 'unfurl.json'
      const _patch = typeof(patch) == 'string'? JSON.parse(patch): patch
      const identifier = `${projectPath}/${_path}`
      const files = db.get('files').value()
      if(!files[identifier]) files[identifier] = {}
      const patchTarget = files[identifier]
      for(const patchInner of _patch) {
        const typename = patchInner.__typename
        const deleted = patchInner.__deleted
        let patchTargetInner = patchTarget
        if(typename  != '*') {
          if(!patchTargetInner[typename]) {
            patchTargetInner[typename] = {}
          }
          patchTargetInner = patchTargetInner[typename]
        }
        if(deleted) {
          if(deleted == '*') {
            if(typename == '*') {
              for(let key in patchTarget) delete patchTarget[key]
            } else {
              delete patchTarget[typename]
            }
          } else {
            delete patchTarget[deleted]
          }
          continue
        }
        patchTargetInner[patchInner.name] = patchInner
      } 
      db.write()
      return {isOk: true, errors: []}
    },

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
  },

  Subscription: {
  },

}
