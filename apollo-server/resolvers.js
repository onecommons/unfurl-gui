import GraphQLJSON from 'graphql-type-json'
import _ from 'lodash';
import {join, resolve} from 'path'
import {writeLiveRepoFile, readLiveRepoFile, readRepoFile} from './utils/db'
import {getBlueprintJson} from './utils/iterate_projects'

const username = process.env.UNFURL_CLOUD_USERNAME || "demo"

function findDeployment(repo, path) {
  const target = join(repo, path)
  let ensembleJSONRaw = readLiveRepoFile(
    target,
    'ensemble.json'
  ) || readLiveRepoFile(
    target,
    'deployment.json'
  )
  return ensembleJSONRaw
}

function mergeTypes(json) {
  const resourceTypes = json["ResourceType"]
  const typesRepo = json.repositories && json.repositories.types && json.repositories.types.url
  if (typesRepo) {
    const files = {
      src: 'service-template.yaml',
      dst: 'unfurl-types.json',
      ensemble: 'dummy-ensemble.yaml'
    }
    const types = getBlueprintJson("unfurl-types", files)
    // types overrides resourceTypes
    if (types) {
        Object.assign(resourceTypes, types["ResourceType"])
        console.log("merged!")
    }
  }
  return json;
}

export default {
  JSON: GraphQLJSON,


  Query: {
  
    applicationBlueprint: (root, args, { db }) => {
        return getBlueprintJson(args.fullPath)
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
      const environments = readLiveRepoFile(projectPath, 'environments.json')
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
            const deployment = findDeployment(projectPath, path)
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
        const environments = readLiveRepoFile(fullPath, 'environments.json')

        if (!environments) {
          return [];
        }
        // XXX merge in defaults
        // const defaults = environments['DeploymentEnvironment']['defaults']
        // env_hash['connections'] = defaults.merge(env_hash || Hash.new)
        //mergeTypes(environments); this wasn't working for some reason
        const result = Object.entries(environments['DeploymentEnvironment']).map(([key, value]) => ({
            __typeName: 'Environment',
            path: key,
            name: key,
            state: 'available',
            _project: namespace,
          clientPayload: {
            // XXX for consistency should be: "DeploymentEnvironment": { [key]: value },
            "DeploymentEnvironment": value,
            "ResourceType": readRepoFile('unfurl-types', 'unfurl-types.json').ResourceType,
            "DeploymentPath": environments["DeploymentPath"]
          }
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
    json: (obj, args, { }) => mergeTypes(obj)
  }, 
 

  // ResourceTemplates: {
  //   clientPayload: (obj, args, { }) => obj
  // },

  Mutation: {

    updateDeploymentObj(root, {input}, {db}) {
      const {projectPath, patch, path} = input
      const _path = path || 'unfurl.json'
      const _patch = typeof(patch) == 'string'? JSON.parse(patch): patch
      const patchTarget = readLiveRepoFile(projectPath, path) || {}
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
            delete patchTarget[typename][deleted]
          }
          continue
        }
        patchTargetInner[patchInner.name] = patchInner
      } 
      
      writeLiveRepoFile(projectPath, path, patchTarget)
      return {isOk: true, errors: []}
    },
  },

  Subscription: {
  },

}
