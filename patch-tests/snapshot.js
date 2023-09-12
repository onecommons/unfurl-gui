import {expect, jest} from '@jest/globals'
import axios from '~/lib/utils/axios_utils'
import fs from 'fs'
import TargetState from './target-state'
import Assertions from './assertions.js'
import {sleep} from 'oc_vue_shared/client_utils/misc'

class Snapshot {
  constructor(path) {
    Object.assign(this, JSON.parse(fs.readFileSync(`./patch-tests/snapshots/${path}`, 'utf-8')).log)

    this.path = path
    this.name = path.replace(/\.har$/, '')

    const documents = this.entries.filter(
      entry => entry?._resourceType == 'document' && !entry.request.url.includes('crossorigin-xhr')
    )

    expect(documents).toHaveLength(1)

    try {
      this._patches = JSON.parse(fs.readFileSync(`./patch-tests/snapshots/${this.name}.patch.json`, 'utf-8'))
    } catch(e) {console.error(e.message)}

    this.user = JSON.parse(
      this.entries.find(
        entry => entry.request.url.endsWith('/api/v4/user')
      ).response.content.text
    )

    this.document = documents[0]

    this.entries = this.entries.filter(
      entry => entry?._resourceType == 'xhr'
    )

    this.test = this._test.bind(this)
  }

  get documentUrl() {
    return new URL(this.document.request.url)
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

  get queryString() {
    return this.document.request.queryString.reduce((acc, {name, value}) => (acc[name] = decodeURIComponent(value)) && acc, {})
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

    // await this.fetchProject({projectPath, fetchPolicy: 'network-only', projectGlobal: this.project.globalVars}); // NOTE this.project.globalVars

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
    expect(store.getters.resolveDeploymentTemplate(this.templateSlug)).toHaveProperty('name')
    expect(store.getters.getCurrentEnvironmentName).toBe(this.environmentName)
    expect(store.getters.getDeploymentTemplate).toHaveProperty('name')
    expect(store.getters.getPrimaryCard).toHaveProperty('name')
  }

  constructTargetState(store) {
    return new TargetState(store, this.patches)
  }

  async _test(store, after) {
    await after
    await sleep(1000)
    window.gon = {current_username: this.user.username}

    store.commit('setCurrentNamespace', this.user.username)

    const axiosIntercept = (method) => {

      return async (interceptUrl, ...args) => {
        try {
          // TODO handle matching bodies
          const {response}  = this.entries.find(e => {
            const url = new URL(e.request.url)


            const ref = url.pathname + url.search
            let interceptRef = interceptUrl

            try {
              const interceptParsed = new URL(interceptUrl)
              interceptRef = interceptParsed.pathname + interceptParsed.search
            } catch(e) { }

            const routesMatch = ref == interceptRef ||  ref == decodeURIComponent(interceptRef) || decodeURIComponent(ref) == decodeURIComponent(decodeURIComponent(interceptRef))

            const methodsMatch = e.request.method.toLowerCase() == method

            return routesMatch && methodsMatch
          })


          const result = {
            status: response.status,
            data: response.content.mimeType == 'application/json'? JSON.parse(response.content.text): response.content.text
          }

          // console.log({interceptUrl, result})
          return result
        } catch(e) {
          console.error(interceptUrl, method, e)
          return {status: 404, data: null}
        }

      }
    }

    jest.spyOn(axios, 'get').mockImplementation(axiosIntercept('get'))
    jest.spyOn(axios, 'post').mockImplementation(axiosIntercept('post'))
    jest.spyOn(axios, 'patch').mockImplementation(axiosIntercept('patch'))

    await this.initStore(store)

    this.setupAssertions(store)

    store.commit('setUpdateType', 'deployment')

    const targetState = this.constructTargetState(store)

    await targetState.createAll()

    const {patch} = await store.dispatch('commitPreparedMutations', {dryRun: true})

    const assertions = Assertions[this.name]

    if(typeof assertions == 'function') {
      await assertions(store, patch)
    }

  }
}

export default Snapshot
