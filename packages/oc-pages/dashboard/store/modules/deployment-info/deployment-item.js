import axios from '~/lib/utils/axios_utils'
import * as routes from '../../../router/constants'
import {fetchCommit, fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'
export default class DeploymentItem {
    constructor(context) {
        Object.assign(this, context)
        this.commitPromises = []
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
        const i = n == -1 ? this.pipelines?.lastIndex ?? -1: n
        if(i == -1) return null

        let commitPromise
        if(!(commitPromise = this.commitPromises[i]) && this.projectId && this.commitId) {
            commitPromise = this.commitPromises[i] = fetchCommit(this.projectId, this.commitId)
        }
        try {
            return await commitPromise
        } catch(e) {
            return null
        }
    }

    get createdAt() {
        let t
        if(t = this.deployment?.deployTime || this.deployment?.commitTime) {
            return new Date(Date.parse(t))
        }
        return null
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

    get readonlyLink() { return `/${this.projectPath}/-/deployments/${this.environment.name}/${this.deployment.name}`}
    get editableLink() {
        let overviewPath = this.deployment.projectPath
        if(window.gon.unfurl_gui) {
            overviewPath += '/-/overview'
        }
        let result = `/${overviewPath}/deployment-drafts/${encodeURIComponent(this.projectPath)}/${this.environment.name}/${this.deployment.name}?fn=${this.deployment.title}`
        if(this.deployment.blueprintPath) {
            result += `&blueprintPath=${this.deployment.blueprintPath}`
        }
        if(this.deployment.branch) {
            result += `&bprev=${this.deployment.branch}`
        }

        return result
    }
    get viewableLink() { return this.isDraft? this.editableLink: this.readonlyLink }
    get viewableTo() {
        return {to: {name: routes.OC_DASHBOARD_DEPLOYMENTS, params: {name: this.deployment.name, environment: this.environment.name}}}
    }

    get createdAtDate() { return this.createdAt?.toLocaleDateString() }
    get createdAtTime() { return this.createdAt?.toLocaleTimeString() }
    get createdAtText() {
        if(!(this.createdAtDate && this.createdAtTime)) return ''
        return `${this.createdAtDate} ${this.createdAtTime}`
    }
    get isEditable() {
        return (!this.isDeployed) && (this.isDraft || this.jobStatusIsEditable)
    }
    get isDraft() {
        return this.deployment.__typename == 'DeploymentTemplate' && !this.pipeline
    }
    get isUndeployed() {
        return this.deployment?.workflow == 'undeploy'
    }
    get isDeployed() {
        return !!this.deployment?.workflow
    }
    get isRunning() {
        return this.isDeployed && !this.isUndeployed && this.deployment.status == 1
    }
    get isIncremental() {
        return this.deployPath?.incremental_deploy ?? false
    }
    get isJobCancelable() {
        return this.job?.cancelable ?? false
    }

    async cancelJob() {
        if(!this.isJobCancelable) throw new Error(`Job ${this.job?.id || -1} is not cancelable`)
        await axios.post(this.cancelLink)
    }


    get autostopScheduled() {
        return this.autostopJob?.status == 'SCHEDULED' && new Date(this.autostopJob.scheduledAt)
    }
    get isAutostopCancelable() {
        return this.autostopJob?.status == 'SCHEDULED'
    }
    get autostopConsoleLink() {
        if(this.projectPath && this.autostopJob) {
            return `/${this.projectPath}/-/jobs/${this.autostopJob.id}`
        }
    }
    get autostopCancelLink() {
        if(this.projectPath && this.autostopJob) {
            return `${this.autostopConsoleLink}/unschedule`
        }
    }

    async cancelAutostop() {
        if(!this.isAutostopCancelable) throw new Error(`Job ${this.autostopJob?.id || -1} is not cancelable`)
        await axios.post(this.autostopCancelLink)
    }

    get isRenamable() {
        return (
            this.deployPath != this.application.blueprintPath &&
            this.deployment.source != '__generated'
        )
    }
}
