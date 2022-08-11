import axios from '~/lib/utils/axios_utils'
import * as routes from '../../../router/constants'
import {fetchCommit, fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
export default class DeploymentItem {
    constructor(context) {
        Object.assign(this, context)
        this.commitPromises = []
    }

    get pipeline() {
        return this.deployPath?.pipeline
    }

    get pipelines() {
        return this.deployPath?.pipelines
    }

    get projectId() {
        return this.deployPath?.project_id || this.deployPath?.projectId // project_id will be used on DeploymentPath records going forward
    }
    
    get commitId() {
        return this.pipeline?.commit?.id || this.pipeline?.commit_id
    }

    async getCommit(n=-1) {
        const i = n == -1 ? this.pipelines.lastIndex: n

        let commitPromise
        if(!(commitPromise = this.commitPromises[i])) {
            commitPromise = this.commitPromises[i] = fetchCommit(this.projectId, this.commitId)
        }
        try {
            return await commitPromise
        } catch(e) {
            return null
        }
    }

    async getCreatedAt(n=-1) {
        const date = (await this.getCommit(n))?.created_at
        return date && new Date(date)
    }

    get pipelineWorkflow() {
        return this.pipeline?.variables?.WORKFLOW
    }

    get artifactsLink() {
        if(this.projectPath && this.job) {
            return `${this.consoleLink}/artifacts/browse`
        }
    }

    async getUpstreamPipelineLink() {
        if(this.projectPath && this.pipeline?.upstream_pipeline_id && this.pipeline?.upstream_project_id) {
            const upstreamProjectPath = (await fetchProjectInfo(this.pipeline.upstream_project_id))?.path_with_namespace
            return `/${upstreamProjectPath}/-/pipelines/${this.pipeline.upstream_pipeline_id}`
        }
    }

    get rawLink() {
        if(this.projectPath && this.job) {
            return `${this.consoleLink}/raw`
        }
    }

    get cancelLink() {
        if(this.projectPath && this.job) {
            return `${this.consoleLink}/cancel`
        }
    }

    get consoleLink() {
        if(this.projectPath && this.job) {
            return `/${this.projectPath}/-/jobs/${this.job.id}`
        }
    }

    get jobStatus() {
        return this.job?.status?.toLowerCase()
    }

    get jobStatusIsEditable() {
        return this.jobStatusIsUnsuccessful
    }

    get jobStatusIsUnsuccessful() {
        switch(this.jobStatus) {
            case 'canceled':
            case 'failed':
                return true
            default:
                return false
        }
    }
    
    get jobStatusMessage() {
        switch(this.jobStatus) {
            case 'canceled':
                return '(Canceled)'
            case 'failed':
                return '(Failed)'
            default:
                return ''
        }
    }
    
    get readonlyLink() { return `/home/${this.namespace}/-/${this.environment.name}/${this.deployment.name}`}
    get editableLink() { return `/${this.deployment.projectPath}/deployment-drafts/${this.environment.name}/${this.deployment.name}?fn=${this.deployment.title}`}
    get viewableLink() { return this.isDraft? this.editableLink: this.readonlyLink }
    get viewableTo() {
        return {to: {name: routes.OC_DASHBOARD_DEPLOYMENTS, params: {name: this.deployment.name, environment: this.environment.name}}}
    }

    async getCreatedAtDate(n=-1) { const createdAt = await this.getCreatedAt(n); return createdAt?.toLocaleDateString() }
    async getCreatedAtTime(n=-1) { const createdAt = await this.getCreatedAt(n); return createdAt?.toLocaleTimeString() }
    async getCreatedAtText(n=-1) {
        const createdAtDate = await this.getCreatedAtDate(n), createdAtTime = await this.getCreatedAtTime(n)
        if(!(createdAtDate && createdAtTime)) return ''
        return `${createdAtDate} ${createdAtTime}`
    }
    get isEditable() {
        return (!this.isDeployed) && (this.isDraft || this.jobStatusIsEditable)
    }
    get isDraft() {
        return this.deployment.__typename == 'DeploymentTemplate' && this.pipeline === undefined
    }
    get isUndeployed() {
        return this.deployment.__typename == 'Deployment' && !this.isDeployed && (this.deployment?.status != 3)
    }
    get isDeployed() {
        return this.deployment.__typename == 'Deployment' && (this.deployment?.status == 1)
    }
    get isJobCancelable() {
        return this.job?.cancelable ?? false
    }


    async cancelJob() {
        if(!this.isJobCancelable) throw new Error(`Job ${this.job?.id || -1} is not cancelable`)
        await axios.post(this.cancelLink)
    }
}
