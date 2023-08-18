#!/usr/bin/env node

/*
process.env.OC_URL = 'http://skelaware.abreidenbach.com:3000'
process.env.OC_USERNAME = 'root'
process.env.OC_PASSWORD = '******'
*/

const {spawnSync} = require('child_process')
const {sleep} = require('./shared/util.js')
const setRepoVisibility = require('./set-repo-visibility.js')

function constructTargetURL(projectPath, username=process.env.OC_USERNAME, password=process.env.OC_PASSWORD) {
  const {protocol, host} = new URL(process.env.OC_URL)
  const targetURL = `${protocol}//${username}:${password}@${host}/${projectPath}`
  return targetURL
}

// TODO check that localRepoPath exists
function pushLocalRepo(localRepoPath, projectPath, options) {
  const {
    force,
    skipCI,
    setUpstream,
    username,
    password,
    tags,
    branch,
  } = Object.assign({
    force: false,
    skipCI: true,
    setUpstream: true,
    branch: null,
    tags: false,
  }, options)
  console.log({setUpstream}, options)
  const url = constructTargetURL(projectPath, username, password)
  const args = []


  args.push('push')
  if(tags) {
    args.push('--tags')
  }
  if(force) args.push('-f')
  if(setUpstream) args.push('--set-upstream')
  args.push(url)

  if(branch) {
    args.push(branch)
  }

  if(skipCI) {
    args.push('-o')
    args.push('ci.skip')
  }

  console.log('git', ...args)
  const cmdOpts = {cwd: localRepoPath, encoding: 'utf-8'}
  const result = spawnSync('git', args, cmdOpts)
  const {status, stdout, stderr, error} = result 

  if(error) {
    throw new Error(error.message)
  }

  if(stderr) console.error(stderr)
  if(stderr && stderr.includes('fatal: not a git repository')) {
    const {stderr} = spawnSync('git', ['init', '--initial-branch=main'], cmdOpts)
    if(stderr && stderr.includes('error: unknown option')) {
      return false
    }

    spawnSync('git', ['add', '.'], cmdOpts)
    spawnSync('git', ['commit', '-m', 'init'], cmdOpts)

    return pushLocalRepo(localRepoPath, projectPath, {...options, branch: 'main'})
  }

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
  for(const key of Object.keys(args)) {
    try {
      args[key] = JSON.parse(args[key])
    } catch(e) {}
  }
  const projectPath = args.projectPath || args['project-path']
  const path = args.path || args._[0]
  if (!projectPath) {
    throw new Error('expected --project-path to be set')
  }

  if(!path) {
    throw new Error('expected path to be set')
  }

  let success = pushLocalRepo(path, projectPath, args)

  if(!success) throw new Error('Failed to push repo')

  console.log('Pushed successfully')

  if(args.public) {
    success = await setRepoVisibility(projectPath, 'public')
    if(!success) throw new Error('Failed to update visibility')
  }
  
}
