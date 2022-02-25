import fs from 'fs'
import path from 'path'
import {execSync} from 'child_process'
import {USER_HOME_PROJECT} from '../../src/gitlab-oc/vue_shared/util.mjs';

function exportBlueprint(cwd, fullPath) {
  const UNFURL_CMD = process.env.UNFURL_CMD || 'unfurl'
  const cmd = `${UNFURL_CMD} --home '' export --format blueprint ensemble-template.yaml`
  console.log(cmd)
  let out;
  try {
    out = execSync(cmd, { cwd });
  } catch (e) {
    console.log(`error exporting ${fullPath}:`, e)
    return false;
  }
  try {
    fs.writeFileSync(fullPath, out)
  } catch (e) {
    console.log(`error writing to ${fullPath}:`, e)
    return false;
  }
  console.log(`exported to ${fullPath}`)
  return true;
}

export function getBlueprintJson(reposDir, project, runExport) {
  let jsonFile = 'blueprint.json'
  let fullPath = path.join(reposDir, project, jsonFile);
  if (!fs.existsSync(fullPath)) {
    jsonFile = 'unfurl.json'
    fullPath = path.join(reposDir, project, jsonFile);
  }
  const ensemblePath = path.join(reposDir, project, 'ensemble-template.yaml');
  if (runExport && fs.existsSync(ensemblePath)) {
    const ensembleStat = fs.statSync(ensemblePath);
    const jsonStat = fs.statSync(fullPath);
    if (ensembleStat.mtimeMs > jsonStat.mtimeMs) {
      exportBlueprint(path.join(reposDir, project), fullPath)
    }
  }
  try {
    const blueprint = JSON.parse(
      fs.readFileSync(fullPath, 'utf-8')
    )
    return blueprint;
  } catch(e) {
    console.error("in", fullPath, e)
    return null;
  }
}

export function iterateProjects(reposDir) {
  const projects = []
  for (const repo of fs.readdirSync(reposDir)) {
    const repoDir = path.join(reposDir, repo);
    if (!fs.statSync(repoDir).isDirectory())
        continue
    for (const project of fs.readdirSync(repoDir)) {
      if (!fs.statSync(path.join(repoDir, project)).isDirectory())
          continue
      if (project == USER_HOME_PROJECT)
        continue
      const projectPath = `${repo}/${project}`
      const blueprint = getBlueprintJson(reposDir, projectPath, false)
      if (blueprint)
        projects.push({projectPath, blueprint})
    }
  }
  return projects
}

//const REPOS_DIR = path.join(process.cwd(), '../repos')
//console.log(iterateProjects(REPOS_DIR))
