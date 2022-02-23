import GraphQLJSON from 'graphql-type-json'
import _ from 'lodash';
import {join} from 'path'
import {writeLiveRepoFile, readLiveRepoFile} from './utils/db'

const username = process.env.UNFURL_CLOUD_USERNAME || "demo"

function findDeployment(repo, path) {
  const target = join(repo, path)
  let ensembleJSONRaw = readLiveRepoFile(
    target,
    'deployment.json'
  ) || readLiveRepoFile(
    target,
    'ensemble.json'
  )
  return ensembleJSONRaw
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
        const environments = db.get('environments').value()[namespace]['DeploymentEnvironment']
        if (!environments) {
          return [];
        }
        // XXX defaults = db.get('environments').value()[namespace]['defaults']
        // env_hash['connections'] = defaults.merge(env_hash['connections'] || Hash.new)
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
            delete patchTarget[deleted]
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
