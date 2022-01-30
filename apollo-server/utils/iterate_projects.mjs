import fs from 'fs'
import path from 'path'
import yaml from 'yaml'

export default function iterateProjects(reposDir) {
  const projects = []
  for (const repo of fs.readdirSync(reposDir)) {


    for(const project of fs.readdirSync(path.join(reposDir, repo))) {
      if(project == 'unfurl-home') continue
      const fullPath = path.join(reposDir, repo, project, 'blueprint.json')
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
