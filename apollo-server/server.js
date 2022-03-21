import path from 'path'
import express from 'express'
import fs from 'fs'
import {execSync} from 'child_process'
import {USER_HOME_PROJECT} from '../packages/oc-pages/vue_shared/util.mjs'
import {writeLiveRepoFile, readLiveRepoFile, resolveLiveRepoFile} from './utils/db'

const skeletonPath = path.resolve(__dirname, './repos/testing/dashboard/unfurl-skeleton')

/*
if not exists (path/to/environment/deploymentname)
  unfurl clone blah blah
  unfurl deploy path/to/environment/deploymentname
  unfurl export path/to/environment/deploymentname > path/to/environment/deploymentname/ensemble.json (edited)
*/
export default app => {
  app.use(express.json({ limit: '50mb' }))
  app.use('/files', express.static(path.resolve(__dirname, '../live/uploads')))
  app.post(`/:user/${USER_HOME_PROJECT}/-/pipelines`, (req, res) => {

    let BLUEPRINT_PROJECT_URL, DEPLOY_ENVIRONMENT, DEPLOY_PATH, DEPLOYMENT
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
      }
    }
    const UNFURL_CMD = process.env.UNFURL_CMD || 'unfurl'

    const userHome = `${req.params.user}/${USER_HOME_PROJECT}`

    const cloned = fs.existsSync(resolveLiveRepoFile(userHome, path.join(DEPLOY_PATH, 'ensemble.yaml')))

    const cwd = resolveLiveRepoFile(userHome, '')
    const repo = (new URL(BLUEPRINT_PROJECT_URL).pathname).split('.')[0]; // strip .git
    const blueprintProjectURL = path.resolve(__dirname, './repos/' + repo)
    const clone = `${UNFURL_CMD} -vv clone --existing --overwrite --mono --use-environment ${DEPLOY_ENVIRONMENT} --skeleton ${skeletonPath} ${blueprintProjectURL} ${DEPLOY_PATH}`
    const deploy = `${UNFURL_CMD} -vv --home . deploy --approve ${DEPLOY_PATH}`
    const exportCmd = `${UNFURL_CMD} -vv --home . export ${DEPLOY_PATH} > ${DEPLOY_PATH}/ensemble.json`
    let currentCommand, output
    function execHelper(cmd) {
      console.log(cmd)
      currentCommand = cmd
      output = execSync(cmd, {cwd})
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
