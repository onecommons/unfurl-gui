import mkdirp from 'mkdirp'
import fs from 'fs'
import glob from 'glob'
import { join, dirname, resolve, basename, extname } from 'path'
export const db = {}; // XXX who is using this??
const LIVE_DIR = resolve(__dirname, '../../live')
const LIVE_REPOS_DIR = resolve(LIVE_DIR, 'repos')
mkdirp.sync(LIVE_REPOS_DIR)

const REPOS_DIR = resolve(__dirname, '../repos')

export function resolveLiveRepoFile(repo, path) {
  return resolve(LIVE_REPOS_DIR, repo, typeof(path) == 'string'? path: 'unfurl.json')
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

const REPOS_SEED = resolve(__dirname, '../repos/demo')
const RECREATE_EXTENSIONS = ['json', 'yaml']

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

const targetBase = join(LIVE_REPOS_DIR, "demo")
if(!process.env.NO_FIXTURES) {
  for(const filePath in files) {
    const liveFilePath = resolve(targetBase, filePath)
    if(fs.existsSync(liveFilePath)) continue
    const fileContents = files[filePath]
    const targetDir = resolve(targetBase, dirname(filePath))
    console.log(`possibly overwriting files in ${targetDir}, set NO_FIXTURES=1 to disable this.`)
    mkdirp.sync(targetDir)
    fs.writeFileSync(liveFilePath, fileContents)
  }
} else {
  console.log(`NO_FIXTURES is set, keeping files in ${REPOS_SEED}`)
}
