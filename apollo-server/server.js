import path from 'path'
import express from 'express'
import fs from 'fs'
import os from 'os'
import {execSync} from 'child_process'
const USER_HOME_PROJECT = 'dashboard'
import {writeLiveRepoFile, readLiveRepoFile, resolveLiveRepoFile} from './utils/db'
import proxiedRoutes from './server/proxied-routes'
import mkdirp from 'mkdirp'

const tmpDir = path.join(os.tmpdir(), '.unfurl-gui')
function setPid(program, pid) {
  mkdirp.sync(tmpDir)
  return fs.writeFileSync(path.join(tmpDir, `${program}.pid`), pid.toString())
}
setPid('apollo', process.pid)


const variables = [
  {
    environment_scope: 'production-gcp',
    id: 1,
    key: 'hello',
    value: 'world',
    variable_type: 'env_var',
    protected: false
  }
]
let highestVariableID = 1

function variablesForEnvironment(environmentName) {
  const result = {}
  for(const variable of variables) {
    if(variable.environment_scope == environmentName || variable.environment_scope == '*') {
      result[variable.key] = variable.value
    }
  }
  return result
}

export default app => {
  app.use(express.json({ limit: '50mb' }))
  app.use('/files', express.static(path.resolve(__dirname, '../live/uploads')))
  app.use('/proxied', proxiedRoutes)
  app.use((req, res, next) => {
    console.log(req.url)
    next()
  })


  app.get('/onecommons/unfurl-types/-/raw/main/icons/:icon', async (req, res) => {
    try {
      const fileContents = await fs.promises.readFile(path.join(__dirname, 'repos', 'unfurl-types', 'icons', req.params.icon), 'utf-8')
      res.setHeader('content-type', 'image/svg+xml')
      res.send(fileContents)
    }
    catch(e) {
      console.error(e)
      res.status(404).send()
    }
  })

  app.get(`/:user/${USER_HOME_PROJECT}/-/variables`, (req, res) => {
    res.send({variables})
  })

  app.patch(`/:user/${USER_HOME_PROJECT}/-/variables`, (req, res) => {
    const variables_attributes = req.body.variables_attributes || []
    for(const variable of variables_attributes) {
      variable.value = variable.secret_value
      delete variable.secret_value
      if(!variable.environment_scope) variable.environment_scope = '*'
      if(variable.id) {
        let idx = variables.findIndex(v => v.id == variable.id)
        variables[idx] = variable
        highestVariableID = Math.max(variable.id, highestVariableID)
      } else {
        variable.id = ++highestVariableID
        variables.push(variable)
      }
    }
    res.send({variables})
  })



  app.post(`/:user/${USER_HOME_PROJECT}/-/pipelines`, (req, res) => {

    let BLUEPRINT_PROJECT_URL, DEPLOY_ENVIRONMENT, DEPLOY_PATH, DEPLOYMENT
    let WORKFLOW = 'deploy'
    for(const variable of req.body.variables_attributes) {
      const {key, secret_value} = variable
      switch(key) {
        case 'BLUEPRINT_PROJECT_URL':
          BLUEPRINT_PROJECT_URL = secret_value; break
        case 'DEPLOY_ENVIRONMENT':
          DEPLOY_ENVIRONMENT = secret_value; break
        case 'DEPLOY_PATH':
          DEPLOY_PATH = secret_value; break
        case 'DEPLOYMENT':
          DEPLOYMENT = secret_value; break
        case 'WORKFLOW':
          WORKFLOW = secret_value; break
      }
    }
    const UNFURL_CMD = process.env.UNFURL_CMD || 'unfurl'

    const userHome = `${req.params.user}/${USER_HOME_PROJECT}`

    const cloned = fs.existsSync(resolveLiveRepoFile(userHome, path.join(DEPLOY_PATH, 'ensemble.yaml')))


    const cwd = resolveLiveRepoFile(userHome, '')
    const repo = (new URL(BLUEPRINT_PROJECT_URL).pathname).split('.')[0]; // strip .git
    //const blueprintProjectURL = `https://gitlab.com/onecommons/${repo}`
    const blueprintProjectURL = path.resolve(__dirname, './repos/' + repo)
    const env = {...process.env, ...variablesForEnvironment(DEPLOY_ENVIRONMENT), BLUEPRINT_PROJECT_URL: blueprintProjectURL, DEPLOY_ENVIRONMENT, DEPLOY_PATH, WORKFLOW}

    console.log(blueprintProjectURL)
    const clone = `${UNFURL_CMD} -vv --home '' clone --existing --overwrite --mono --use-environment ${DEPLOY_ENVIRONMENT} --skeleton dashboard ${blueprintProjectURL} ${DEPLOY_PATH}`
    const deploy = `${UNFURL_CMD} -vvv --home '' ${WORKFLOW} --use-environment ${DEPLOY_ENVIRONMENT} --approve ${DEPLOY_PATH}`
    const exportCmd = `${UNFURL_CMD} -vv --home '' export --use-environment ${DEPLOY_ENVIRONMENT} ${DEPLOY_PATH} > ${DEPLOY_PATH}/ensemble.json`
    let currentCommand, output

    function execHelper(cmd) {
      console.log("***** RUNNING COMMAND ******")
      console.log(cmd)
      currentCommand = cmd
      output = execSync(cmd, {cwd, env, stdio: 'inherit'})
    }

    try {
      if(!cloned) {
        execHelper(clone)
      }
      execHelper(deploy)
      execHelper(exportCmd)
    } catch(e) {
      console.error(`exit code ${e.status}`)
      res.status(500).send({currentCommand, status: e.status, id: null, output})
      return
    }
    res.send({ status: 0, id: `${DEPLOY_ENVIRONMENT}/${DEPLOYMENT}` })
  })
}
