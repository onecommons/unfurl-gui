import Lowdb from 'lowdb'
import FileSync from 'lowdb/adapters/FileSync'
import mkdirp from 'mkdirp'
import fs from 'fs'
import glob from 'glob'
import { join, dirname, resolve, basename, extname } from 'path'
import iterateProjects from './iterate_projects'
import iterateEnvironments from './iterate_environments'

const LIVE_DIR = resolve(__dirname, '../../live')
const REPOS_DIR = resolve(LIVE_DIR, 'repos')
mkdirp.sync(REPOS_DIR)

export const db = new Lowdb(new FileSync(resolve(__dirname, '../../live/db.json')))

export function resolveLiveRepoFile(repo, path) {
  return resolve(REPOS_DIR, repo, typeof(path) == 'string'? path: 'unfurl.json')
}
export function readLiveRepoFile(repo, path) {
  const target = resolveLiveRepoFile(repo, path)
  console.log('read', target)
  try {
    return JSON.parse(
      fs.readFileSync(target, 'utf-8')
    )
  } catch(e) {
    if(!e.message.startsWith('ENOENT')) console.error(e.message)
    return null
  }
}
export function writeLiveRepoFile(repo, path, _contents) {
  const dest = resolveLiveRepoFile(repo, path)
  const destDir = dirname(dest)
  mkdirp.sync(destDir)
  const contents = typeof(_contents == 'object')?
    JSON.stringify(_contents, null, 2): _contents

  console.log('write', dest)
  fs.writeFileSync(dest, contents)
}

const dataDir = resolve(__dirname, '../data')
const projects = {}

const JSON_EXT = '.json'
for(const tld of fs.readdirSync(dataDir)) {
  for(const f of fs.readdirSync(resolve(dataDir, tld))) {
    if(extname(f) != JSON_EXT) continue
    const payload = fs.readFileSync(resolve(dataDir, tld, f), 'utf-8')
    projects[`${tld}/${basename(f, JSON_EXT)}`] = JSON.parse(payload)
  }
}

for(const {projectPath, blueprint} of iterateProjects(resolve(__dirname, '../repos'))) {
  projects[projectPath] = blueprint
}

const REPOS_SEED = resolve(__dirname, '../repos')
const RECREATE_EXTENSIONS = ['json', 'yaml']

const environments = iterateEnvironments(REPOS_SEED);
const files = {}

// glob doesn't follow symlinked dirs by default to avoid cyclic links
// decided to try this for now to just follow symlinks at the top level
for(const tld of fs.readdirSync(REPOS_SEED)) {
  for(const ext of RECREATE_EXTENSIONS) {
    for(const extFile of glob.sync(resolve(REPOS_SEED, tld, `**/**.${ext}`))) {
      const relativePath = extFile.slice(REPOS_SEED.length + 1)
      files[relativePath] = fs.readFileSync(extFile, 'utf-8')
    }
  }
}
/*
for(const [key, value] of Object.entries(projects)) {
  files[key + '/unfurl.json'] = value
}
for(const [key, value] of Object.entries(environments)) {
  files[key + '/environments.json'] = value
}
*/

const unfurlYaml = fs.readFileSync(resolve(__dirname, '../repos/testing/dashboard/unfurl.yaml'), 'utf-8')
for(const filePath in files) {
  const fileContents = files[filePath]
  const targetDir = resolve(REPOS_DIR, dirname(filePath))
  mkdirp.sync(targetDir)
  /*
  if(filePath.endsWith('environments.json')) {
    fs.writeFileSync(resolve(targetDir, 'unfurl.yaml'), unfurlYaml)
  }
  */
  fs.writeFileSync(resolve(REPOS_DIR, filePath), fileContents)
}

// Seed an empty DB
db.defaults({
  messages: [],
  accounts: [],
  uploads: [],
  projects,
  environments,
  users: {
    "root": {
      environments: [
        { name: "production", cloud: "AWS" },
        {name: "staging", cloud: "GCP"}
      ]
  }}
}).write()
