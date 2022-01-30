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
const environments = {}

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

for (const environmentsObj of iterateEnvironments(resolve(__dirname, '../repos'))) {
  environments[environmentsObj.namespace] = environmentsObj
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
