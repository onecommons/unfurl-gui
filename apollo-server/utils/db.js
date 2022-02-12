import Lowdb from 'lowdb'
import FileSync from 'lowdb/adapters/FileSync'
import mkdirp from 'mkdirp'
import fs from 'fs'
import { resolve, basename, extname } from 'path'
import iterateProjects from './iterate_projects'
import iterateEnvironments from './iterate_environments'

mkdirp(resolve(__dirname, '../../live'))

export const db = new Lowdb(new FileSync(resolve(__dirname, '../../live/db.json')))


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

const environments = iterateEnvironments(resolve(__dirname, '../repos'));
const files = {}
for(const [key, value] of Object.entries(projects)) {
  files[key + '/unfurl.json'] = value
}
for(const [key, value] of Object.entries(environments)) {
  files[key + '/environments.json'] = value
}

// Seed an empty DB
db.defaults({
  messages: [],
  accounts: [],
  uploads: [],
  projects,
  files,
  environments,
  users: {
    "root": {
      environments: [
        { name: "production", cloud: "AWS" },
        {name: "staging", cloud: "GCP"}
      ]
  }}
}).write()
