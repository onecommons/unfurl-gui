#!/usr/bin/env node

/*
process.env.OC_URL = 'http://skelaware.abreidenbach.com:3000'
process.env.OC_USERNAME = 'root'
process.env.OC_PASSWORD = '******'
*/

const {spawnSync} = require('child_process')
const {sleep} = require('./shared/util.js')
const setRepoVisibility = require('./set-repo-visibility.js')

function constructTargetURL(projectPath) {
  const {protocol, host} = new URL(process.env.OC_URL)
  const targetURL = `${protocol}//${process.env.OC_USERNAME}:${process.env.OC_PASSWORD}@${host}/${projectPath}`
  return targetURL
}

function pushLocalRepo(localRepoPath, projectPath) {
  const url = constructTargetURL(projectPath)
  const {status} = spawnSync('git', ['push', url], {cwd: localRepoPath, stdio: 'inherit'})
  return status === 0
}

module.exports = pushLocalRepo

if(require.main === module) {
  try {
    main()
  } catch(e) {
    console.error(e.message)
    process.exit(1)
  }
}
async function main() {
  const args = require('minimist')(process.argv.slice(2))
  const projectPath = args.projectPath || args['project-path']
  const path = args.path || args._[0]
  if (!projectPath) {
    throw new Error('expected --project-path to be set')
  }

  if(!path) {
    throw new Error('expected path to be set')
  }

  let success = pushLocalRepo(path, projectPath)

  if(!success) throw new Error('Failed to push repo')

  console.log('Pushed successfully')

  if(args.public) {
    success = await setRepoVisibility(projectPath, 'public')
    if(!success) throw new Error('Failed to update visibility')
  }
  
}
