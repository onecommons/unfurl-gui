#!/usr/bin/env node
/*
 * Fails when a component listed in packages/oc-pages/strict-components.json
 * has an error under tsconfig.components.strict.json. The program checks every
 * component -- a listed one pulls in what it imports -- so errors elsewhere are
 * expected and ignored. Clean components not yet listed are named, so that
 * promoting one is a one-line change. See the TypeScript plan, 3e.
 */
const {spawnSync} = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const PREFIX = 'packages/oc-pages/'
const listed = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, PREFIX, 'strict-components.json'), 'utf8')))

const run = spawnSync('npx', ['vue-tsc', '--noEmit', '-p', 'tsconfig.components.strict.json'], {cwd: ROOT, encoding: 'utf8'})
const errors = (run.stdout + run.stderr).split('\n').filter(line => / error TS\d+:/.test(line))
const errorFiles = new Set(errors.map(line => line.replace(/\(.*$/, '')))

const failing = errors.filter(line => listed.has(line.replace(/\(.*$/, '').replace(PREFIX, '')))
for(const file of listed) {
  if(!fs.existsSync(path.join(ROOT, PREFIX, file))) failing.push(`${PREFIX}${file}: listed in strict-components.json but missing`)
}

const components = spawnSync('git', ['ls-files', `${PREFIX}*.vue`], {cwd: ROOT, encoding: 'utf8'}).stdout.split('\n').filter(Boolean)
const promotable = components.filter(file => {
  if(errorFiles.has(file) || listed.has(file.replace(PREFIX, ''))) return false
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
  return source.includes('<script lang="ts">') && !source.includes('@ts-nocheck')
})
if(promotable.length) {
  console.log(`strict-clean but not listed in strict-components.json (${promotable.length}):`)
  for(const file of promotable) console.log(`  ${file.replace(PREFIX, '')}`)
}

if(failing.length) {
  console.error(`${failing.length} strict error(s) in listed components:`)
  for(const line of failing) console.error(`  ${line}`)
  process.exit(1)
}
console.log(`${listed.size} strict components clean`)
