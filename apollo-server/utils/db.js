import Lowdb from 'lowdb'
import FileSync from 'lowdb/adapters/FileSync'
import mkdirp from 'mkdirp'
import { resolve } from 'path'

mkdirp(resolve(__dirname, '../../live'))

export const db = new Lowdb(new FileSync(resolve(__dirname, '../../live/db.json')))

const unfurl_json = require("../unfurl.json");
const newschema_json = require("./newschema.json");

// Seed an empty DB
db.defaults({
  messages: [],
  accounts: [],
  uploads: [],
  projects: { "demo/apostrophe-demo": unfurl_json },
  newschema: newschema_json
}).write()
