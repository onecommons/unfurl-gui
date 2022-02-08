import GraphQLJSON from 'graphql-type-json'
import _ from 'lodash';
import {readFileSync, readdirSync} from 'fs'
import {resolve, dirname} from 'path'
const username = process.env.UNFURL_CLOUD_USERNAME || "demo"

const apolloServerDir = resolve(dirname(import.meta.url.replace('file://', '')))
const REPOS_DIR = resolve(apolloServerDir, 'repos')

function findDeployment(deploymentAbsolute) {
  let ensembleJSONRaw 
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

    deployments: (root, args, {db}) => {
        const {projectPath, applicationBlueprint} = args
        const result = []

        const environments = JSON.parse(readFileSync(resolve(REPOS_DIR, projectPath, "environments.json"), 'utf-8')).DeploymentEnvironment


        for(const environment of readdirSync(resolve(REPOS_DIR, projectPath, 'environments'))) {
            const environmentAbsolute = resolve(REPOS_DIR, projectPath, 'environments', environment)
          for (const deployment of readdirSync(environmentAbsolute)) {
                const deploymentAbsolute = resolve(environmentAbsolute, deployment)
                const ensemble = findDeployment(deploymentAbsolute)
                if(applicationBlueprint) {
                    if(!ensemble.ApplicationBlueprint[applicationBlueprint])
                        continue
                }
                
                for(const deployment of Object.values(ensemble.Deployment)) { 
                    if(typeof deployment == 'object') {
                        const assignEnvironment = environments[environment]
                        result.push(Object.assign(
                            deployment, 
                            {environment: assignEnvironment, blueprint: Object.keys(ensemble.ApplicationBlueprint)[0]}
                    ))
                    }
                }
            }
        }
        return result
    },

    // resourceTemplates: (root, args, { db }) => {
    //   // (namespace: String): => ResourceTemplates
    // },

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
            const deployment = findDeployment(deploymentAbsolute)
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
      const {projectPath, typename, patch} = input
      const _patch = typeof(patch) == 'string'? JSON.stringify(patch): patch
      const patchTarget = typename === '*'? db.get('projects').value()[projectPath] : db.get('projects').value()[projectPath][typename]
      console.log(typename, patch)
      if(typename === '*') {
        Object.assign(patchTarget, JSON.parse(readFileSync(resolve(apolloServerDir, 'data', projectPath) + '.json', 'utf-8')))
      } else {
        if(!patchTarget) return {isOk: false, errors: [`Typename '${typename}' does not exist in the target project`]}
        for(let key in patch) {
          if (_patch[key] === null) {
            delete patchTarget[key]
          } else {
            patchTarget[key] = _patch[key]
          }
        }
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
