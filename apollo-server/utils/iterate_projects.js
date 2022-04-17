const path = require('path');
const fs = require('fs')
const glob = require('glob')
const {execSync} = require('child_process')
const USER_HOME_PROJECT = 'dashboard'
const REPOS_DIR = path.resolve(__dirname, '../repos')
const LIVE_REPOS_DIR = path.resolve(__dirname, '../../live/repos')

function exportBlueprint(cwd, fullPath, ensemble) {
  const UNFURL_CMD = process.env.UNFURL_CMD || 'unfurl'
  const cmd = `${UNFURL_CMD} --home '' export --format blueprint ${ensemble}`
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

function getBlueprintJson(project, options) {
  const reposDir = REPOS_DIR
  const files = {
    src: 'ensemble-template.yaml',
    dst: 'unfurl.json',
    ensemble: 'ensemble-template.yaml'
  }
  if (options) {
    Object.assign(files, options)
  }
  let jsonFile = 'blueprint.json'
  let fullPath = path.join(reposDir, project, jsonFile);
  if (!fs.existsSync(fullPath)) {
    jsonFile = files.dst
    fullPath = path.join(reposDir, project, jsonFile);
  }
  const ensemblePath = path.join(reposDir, project, files.src);
  if (fs.existsSync(ensemblePath)) {
    const ensembleStat = fs.statSync(ensemblePath);
    const jsonMtime = fs.existsSync(fullPath) ? fs.statSync(fullPath).mtimeMs : 0;
    if (ensembleStat.mtimeMs > jsonMtime) {
      exportBlueprint(path.join(reposDir, project), fullPath, files.ensemble)
    } else {
      console.log(`${ensemblePath} didn't change, keeping ${fullPath}`)
    }
  } else {
    console.error("no ensemble", ensemblePath)
    return null;
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

function* iterateRepoPaths() {
  for(const unfurlJSON of glob.sync(path.join(REPOS_DIR, '**/unfurl.json'))) {
    yield path.dirname(unfurlJSON)
  }
}

function* iterateLiveRepoPaths() {
  for(const unfurlJSON of glob.sync(path.join(LIVE_REPOS_DIR, '**/unfurl.json'))) {
    yield path.dirname(unfurlJSON)
  }
}

function getProjectPaths() {
  const paths = []
  for(const repo of iterateRepoPaths()) {
    const projectPath = repo.slice(REPOS_DIR.length + 1)
    paths.push(projectPath)
  }

  for(const repo of iterateLiveRepoPaths()) {
    const projectPath = repo.slice(LIVE_REPOS_DIR.length + 1)
    if(!paths.includes(projectPath)) paths.push(projectPath)
  }

  return paths
}

function iterateProjects() {
  const reposDir = REPOS_DIR;
  const projects = []
  for (const repo of fs.readdirSync(reposDir)) {
    if (repo == "unfurl-types")
        continue
    const repoDir = path.join(reposDir, repo);
    if (!fs.statSync(repoDir).isDirectory())
        continue
    for (const project of fs.readdirSync(repoDir)) {
      if (!fs.statSync(path.join(repoDir, project)).isDirectory())
        continue
      if (project == USER_HOME_PROJECT)
        continue
      const projectPath = `${repo}/${project}`
      const blueprint = getBlueprintJson(projectPath)
      if (blueprint) {
        console.log( 'adding repo', projectPath)
        projects.push({ projectPath, blueprint })
      }
    }
  }
  return projects
}

module.exports = { iterateProjects, getBlueprintJson, getProjectPaths };
