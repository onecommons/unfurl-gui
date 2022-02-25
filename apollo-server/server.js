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

    const UNFURL_CMD = process.env.UNFURL_CMD || 'unfurl'
    const BLUEPRINT_PROJECT_URL = req.body['variables[BLUEPRINT_PROJECT_URL]']
    const DEPLOY_ENVIRONMENT = req.body['variables[DEPLOY_ENVIRONMENT]']
    const DEPLOY_PATH = req.body['variables[DEPLOY_PATH]']
    const userHome = `${req.params.user}/${USER_HOME_PROJECT}`

    const cloned = fs.existsSync(resolveLiveRepoFile(userHome, path.join(DEPLOY_PATH, 'ensemble.yaml')))

    const cwd = resolveLiveRepoFile(userHome, '')
    const repo = (new URL(BLUEPRINT_PROJECT_URL).pathname).split('/').pop()
    const blueprintProjectURL = 'https://gitlab.com/onecommons/testing/' + repo
    const clone = `${UNFURL_CMD} clone --existing --overwrite --mono --use-environment ${DEPLOY_ENVIRONMENT} --skeleton ${skeletonPath} ${blueprintProjectURL} ${DEPLOY_PATH}`
    const deploy = `${UNFURL_CMD} deploy --approve ${DEPLOY_PATH}`
    const exportCmd = `${UNFURL_CMD} --home '' export ${DEPLOY_PATH} > ${DEPLOY_PATH}/ensemble.json`
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
      res.status(500).send({currentCommand, status: e.status, output})
      return
    }
    res.send({status: 0})
  })
}
