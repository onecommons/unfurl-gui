import axios from '~/lib/utils/axios_utils'
import * as routes from '../../../router/constants'
import {fetchCommit, fetchProjectInfo} from 'oc_vue_shared/client_utils/projects'

// The unfurl export JSON; typed loosely until the payload types exist.
type Json = Record<string, any>

// A pipeline as a DeploymentPath records it.
interface Pipeline {
    id: number | string
    commit?: {id: string}
    commit_id?: string
    variables?: Record<string, string>
    upstream_pipeline_id?: number
    upstream_project_id?: number
}

// A CI job, as the jobs list query returns it.
interface Job {
    id: string | number
    status?: string
    cancelable?: boolean
    scheduledAt?: string
}

export interface DeploymentItemContext {
    environment: Json
    deployment: Json
    application: Json
    deployPath: Json
    // the dashboard's, set for every item
    projectPath: string
    namespace?: string
    pipeline?: Pipeline
    job?: Job
    autostop?: Pipeline
    autostopJob?: Job
}

function commitIdOf(pipeline: Pipeline | undefined) {
    return pipeline?.commit?.id || pipeline?.commit_id
}

export default class DeploymentItem {
    // filled by Object.assign from the context
    declare environment: Json
    declare deployment: Json
    declare application: Json
    declare deployPath: Json
    declare projectPath: string
    declare namespace?: string
    declare pipeline?: Pipeline
    declare job?: Job
    declare autostop?: Pipeline
    declare autostopJob?: Job
    commitPromises: (Promise<Json> | undefined)[] = []

    constructor(context: DeploymentItemContext) {
        Object.assign(this, context)
    }

    get pipelines(): Pipeline[] | undefined {
        return this.deployPath?.pipelines
    }

    get projectId() {
        return this.deployPath?.project_id || this.deployPath?.projectId // project_id will be used on DeploymentPath records going forward
    }

    get commitId() {
        return commitIdOf(this.pipeline)
    }

    // the commit pipeline n ran, the last pipeline's by default
    async getCommit(n=-1) {
        const i = n == -1 ? (this.pipelines?.length ?? 0) - 1: n
        if(i < 0) return null

        const commitId = commitIdOf(this.pipelines?.[i])
        let commitPromise
        if(!(commitPromise = this.commitPromises[i]) && this.projectId && commitId) {
            commitPromise = this.commitPromises[i] = fetchCommit(this.projectId, commitId)
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
        // Unconditional: 15.11 routed deployment-drafts at the project root, so
        // the fork was left without the prefix. 19.3 serves it from
        // `overview(/*vueroute)` -- oc/config/routes/project.rb -- and a bare
        // /<project>/deployment-drafts/... 404s there.
        const overviewPath = `${this.deployment.projectPath}/-/overview`
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
        await axios.post(this.cancelLink!)
    }


    get autostopScheduled() {
        return this.autostopJob?.status == 'SCHEDULED' && new Date(this.autostopJob.scheduledAt!)
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
        await axios.post(this.autostopCancelLink!)
    }

    get isRenamable() {
        return (
            this.deployPath != this.application.blueprintPath &&
            this.deployment.source != '__generated'
        )
    }
}
