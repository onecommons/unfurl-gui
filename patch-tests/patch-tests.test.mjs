// import regeneratorRuntime from 'regenerator-runtime/runtime'
import fs from 'fs'
import store from './store'
import Snapshot from './snapshot'

/*
        const projectPath = this.project.globalVars.projectPath
        if(!projectPath) throw new Error('projectGlobal.projectPath is not defined')
        const templateSlug =  this.$route.query.ts || this.$route.params.slug;
        const renamePrimary = this.$route.query.rtn;
        const renameDeploymentTemplate = this.$route.query.fn;
        const environmentName = this.$route.params.environment
        if(this.$route.name != routes.OC_PROJECT_VIEW_CREATE_TEMPLATE) {
          this.setUpdateObjectPath(this.deploymentDir);
          this.setUpdateObjectProjectPath(this.getHomeProjectPath);
          this.setEnvironmentScope(environmentName)
        }
        // TODO see if we can get rid of this, since it's probably already loaded
        await this.fetchProject({projectPath, fetchPolicy: 'network-only', projectGlobal: this.project.globalVars}); // NOTE this.project.globalVars
        if(this.hasCriticalErrors) return
        const populateTemplateResult = await this.populateTemplateResources({
          projectPath,
          templateSlug,
          renamePrimary,
          renameDeploymentTemplate,
          environmentName: this.$route.params.environment,
          syncState: this.$route.name == routes.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT
        })

        this.fetchTypesForParams()
*/

const snapshots = fs.readdirSync('./patch-tests/snapshots')
async function har() {
  for(const snapshotPath of snapshots) {
    if(!snapshotPath.match(/\.har$/)) continue
    const snapshot = new Snapshot(snapshotPath)

    test(snapshotPath, () => {
      return snapshot.test(store)
    })
  }
}

har()
