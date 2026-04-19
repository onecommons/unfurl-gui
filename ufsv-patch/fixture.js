const OC_NAMESPACE = process.env.OC_NAMESPACE || 'onecommons/blueprints'
const OC_URL = process.env.OC_URL || 'https://unfurl.cloud'
const PORT = process.env.PORT || '5001'
const UNFURL_SERVER_URL =  `http://localhost:${PORT}`
const TMP_DIR = process.env.UNFURL_TEST_TMPDIR || "/tmp"

import {expect, jest} from '@jest/globals'
import axios from '~/lib/utils/axios_utils'
import fs from 'fs'
import TargetState from './target-state'
import Assertions from './assertions.js'
import {interceptWithMock} from './mocks'
import {sleep} from 'oc_vue_shared/client_utils/misc'

const providerMap = {
  azure: 'az',
  digitalocean: 'do',
  kubernetes: 'k8s'
}

class Fixture {
  constructor(path) {
    this.fixture = JSON.parse(fs.readFileSync(path))

    this.path = path
    this.name = path.replace(/\.json$/, '')

    this.user = {username: 'jest'}
    const blueprint = Object.values(this.fixture.ApplicationBlueprint)[0]
    const deploymentTemplate = Object.values(this.fixture.DeploymentTemplate)[0]
    const projectPath = `${OC_NAMESPACE}/${(deploymentTemplate.projectPath?.split('/')?.pop() || deploymentTemplate.name)}`
    const source = this.source = deploymentTemplate.source
    const environment = this.environment = providerMap[source] || source
    this.queryString = {ts: source, tn: deploymentTemplate.name, fn: deploymentTemplate.title}

    const urlQueryString = Object.entries(this.queryString).map(([key, val]) => `${key}=${val}`).join('&')
    this.documentUrl = new URL(`${OC_URL}/${projectPath}/deployment-drafts/jest%2Fdashboard/${environment}/${deploymentTemplate.name}?${urlQueryString}`)

    this.deploymentDir = `environments/${environment}/${projectPath}/${deploymentTemplate.name}`
    this.test = this._test.bind(this)
  }


  get projectPath() {
    return this.documentUrl.pathname.split(/\/deployments?(-drafts)?/)[0].slice(1)
  }

  get dashboardProjectPath() {
    return decodeURIComponent(this.documentUrl.pathname.split('/').slice(-3)[0])
  }

  get isDraft() {
    return this.documentUrl.pathname.includes('deployment-drafts')
  }

  get templateSlug() { return this.queryString.ts || this.documentUrl.pathname.split('/').pop()}
  get renamePrimary() { return this.queryString.rtn }
  get renameDeploymentTemplate() { return this.queryString.fn }

  get environmentName() {
    return this.documentUrl.pathname.split('/').slice(-2)[0]
  }

  get patches() {
    return this._patches || []
  }

  async initStore(store) {
    const requiredParams = [
      'projectPath',
      'templateSlug',
      // 'renamePrimary,
      // 'renameDeploymentTemplate,
      'environmentName',
      'isDraft'
    ]

    for(const param of requiredParams) {
      const actual = {value: this[param], name: param}
      expect(actual).toHaveProperty('value.toString')
    }

    // this.$store.dispatch('ocFetchEnvironments', {projectPath: this.$store.getters.getHomeProjectPath, branch: this.$route.query.branch || 'main'})

    await store.dispatch('ocFetchEnvironments', {projectPath: this.dashboardProjectPath, branch: 'main'})

    expect(JSON.stringify(store.state.errors.errors, null, 2)).toBe('[]')
    expect(store.state.environments.projectEnvironments).not.toHaveLength(0)

    store.commit('setUpdateType', 'deployment')
    store.commit('setUpdateObjectPath', this.deploymentDir)
    store.commit('setUpdateObjectProjectPath', this.dashboardProjectPath)
    store.commit('setEnvironmentScope', this.environment)
    store.commit('setDeploymentParams', {
        environmentName: this.environment,
        projectUrl: `${OC_URL}/${this.projectPath}`,
        deployPath: this.deploymentDir,
        deploymentName: this.templateSlug,
        deploymentBlueprint: this.templateSlug
    })
    store.commit('setCurrentNamespace', this.user.username)


    await store.dispatch('fetchProject', {projectPath: this.projectPath})


    console.log('populateTemplateResult',
      {
        projectPath: this.projectPath,
        templateSlug: this.templateSlug,
        renamePrimary: this.renamePrimary,
        renameDeploymentTemplate: this.renameDeploymentTemplate,
        environmentName: this.environmentName,
        syncState: this.isDraft
      })

    const populateTemplateResult = await store.dispatch(
      'populateTemplateResources',
      {
        projectPath: this.projectPath,
        templateSlug: this.templateSlug,
        renamePrimary: this.renamePrimary,
        renameDeploymentTemplate: this.renameDeploymentTemplate,
        environmentName: this.environmentName,
        syncState: this.isDraft
      }
    )

    await store.dispatch('fetchTypesForParams')
  }

  setupAssertions(store) {
    expect(store.state.errors.errors).toHaveLength(0)
    expect(store.getters.getCurrentEnvironmentName).toBe(this.environmentName)
    expect(store.getters.resolveDeploymentTemplate(this.templateSlug)).toHaveProperty('name')
    expect(store.getters.getDeploymentTemplate).toHaveProperty('name')
    expect(store.getters.getPrimaryCard).toHaveProperty('name')
  }

  constructTargetState(store) {
    return new TargetState(store, this.fixture)
  }

  async _test(store) {
    await sleep(1000)
    window.gon = {current_username: this.user.username}

    const axiosGet = axios.get
    const axiosPost = axios.post
    const axiosPatch = axios.patch

    const axiosIntercept = (method) => {
      const interceptMethod = {
        get: axiosGet,
        post: axiosPost,
        patch: axiosPatch
      }[method]

      return async (interceptUrl, ...args) => {
        if(/services\/unfurl-server/.test(interceptUrl)) {
          let newUrl = UNFURL_SERVER_URL + interceptUrl
            .replace(OC_URL, '')
            .replace(/\/services\/unfurl-server/, '')
            .replace(/latest_commit=[^&]*/, '')
            .replace(/auth_project=jest%2Fdashboard(&)?/, '')
          const {headers} = method == 'get'? args[0]: args[1]
          delete headers['x-git-credentials']

          if(method == 'post') {
            const body = args[0]
            const patch = body.patch

            for(const entry of patch) {
              if(entry.__typename == 'ResourceTemplate') {
                for(const prop of entry.properties) {
                  if(prop.value.get_env) {
                    if(prop.name.includes('password')) {
                      prop.value = '1169336476639707207aA?'
                    }
                    else if (prop.name.includes('app_key')) {
                      prop.value = 'f977e482cc6e585b4e684e434f1dd878'
                    }
                    else {
                      prop.value = '_REDACTED_'
                      console.warn(`Need a substitution for ${prop.name}`)
                    }
                  }
                }
              }
            }
          }

          let response
          try {
            response = await interceptMethod(newUrl, ...args)
            const fnameUrl = new URL(newUrl)

            fs.writeFileSync(`${TMP_DIR}/ufsv-intercepted/${Date.now()}-${encodeURIComponent(fnameUrl.pathname.slice(1) + fnameUrl.search)}`, JSON.stringify({
              req: [
                newUrl,
                ...args
              ],
              res: response
            }))
          } catch(e) {
            console.error(e, e.response, e.message)
            throw e
          }
          return response
        }
        return interceptWithMock(interceptUrl) || await interceptMethod(interceptUrl, ...args)
      }
    }

    jest.spyOn(axios, 'get').mockImplementation(axiosIntercept('get'))
    jest.spyOn(axios, 'post').mockImplementation(axiosIntercept('post'))
    jest.spyOn(axios, 'patch').mockImplementation(axiosIntercept('patch'))
    jest.spyOn(axios, 'patch').mockImplementation(axiosIntercept('patch'))

    jest.spyOn(console, 'warn').mockImplementation((...args) => console.log('WARN', ...args)) // jest prints out trace for normal console.warn

    await this.initStore(store)

    this.setupAssertions(store)

    const targetState = this.constructTargetState(store)

    await targetState.createAll()

    expect(store.getters.cardIsValid(store.getters.getPrimaryCard))

    await store.dispatch('commitPreparedMutations')

    expect(store.state.errors.errors).toHaveLength(0)

  }
}

export default Fixture
