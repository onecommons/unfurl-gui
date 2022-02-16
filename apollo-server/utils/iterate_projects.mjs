import fs from 'fs'
import path from 'path'
import {USER_HOME_PROJECT} from '../../src/gitlab-oc/vue_shared/util.mjs';

export default function iterateProjects(reposDir) {
  const projects = []
  for (const repo of fs.readdirSync(reposDir)) {


    for(const project of fs.readdirSync(path.join(reposDir, repo))) {
      if (project == USER_HOME_PROJECT) continue
      let fullPath = path.join(reposDir, repo, project, 'blueprint.json');
      if (!fs.existsSync(fullPath)) {
        fullPath = path.join(reposDir, repo, project, 'unfurl.json');
      }
      const projectPath = `${repo}/${project}`
      try {
        const blueprint = JSON.parse(
          fs.readFileSync(fullPath, 'utf-8')
        )
        projects.push({projectPath, blueprint})
      } catch(e) {
        console.error(e)
      }

    }
  }
  return projects
}

//const REPOS_DIR = path.join(process.cwd(), '../repos')
//console.log(iterateProjects(REPOS_DIR))
