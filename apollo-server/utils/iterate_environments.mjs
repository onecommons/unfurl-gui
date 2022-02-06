import fs from 'fs'
import path from 'path'
import {USER_HOME_PROJECT} from '../../src/gitlab-oc/vue_shared/util.mjs';

export default function iterateEnvironments(reposDir) {
  const environments = {}
  for (const repo of fs.readdirSync(reposDir)) {
    if (repo == 'blueprints') continue

    try {
      const environmentsJSON = fs.readFileSync(path.join(reposDir, `${repo}/${USER_HOME_PROJECT}/environments.json`), 'utf-8')
      const parsed = JSON.parse(environmentsJSON)
      environments[`${repo}/${USER_HOME_PROJECT}`] = parsed;
    } catch(e) {
      console.error(e)
      console.error(`could not find environments.json for ${repo}`)
    }
  }

  return environments
}


//const REPOS_DIR = path.join(process.cwd(), '../repos')
//console.log(iterateEnvironments(REPOS_DIR))
