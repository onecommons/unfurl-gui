import axios from '~/lib/utils/axios_utils'
export default class DeploymentItem {
    constructor(context) {
        Object.assign(this, context)
    }

    get pipeline() {
        return this.deployPath?.pipeline
    }

    get pipelines() {
        return this.deployPath?.pipelines
    }


    get createdAt() {
        const date = this.pipeline?.commit?.created_at
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
    
    get readonlyLink() { return `/dashboard/deployments/${this.environment.name}/${this.deployment.name}`}
    get editableLink() { return `/${this.deployment.projectPath}/deployment-drafts/${this.environment.name}/${this.deployment.name}?fn=${this.deployment.title}`}
    get viewableLink() { return this.isDraft? this.editableLink: this.readonlyLink }

    get createdAtDate() { return this.createdAt?.toLocaleDateString() }
    get createdAtTime() { return this.createdAt?.toLocaleTimeString() }
    get createdAtText() {
        if(!(this.createdAtDate && this.createdAtTime)) return ''
        return `${this.createdAtDate} ${this.createdAtTime}`
      /*
        if(!this.createdAt) return 
        const today = (new Date(Date.now())).getDate() 
        const workflow = this.pipelineWorkflow == 'undeploy'? 'Undeployed': 'Deployed'
        if(this.createdAt.getDate() != today) {
            return workflow + ' on ' + this.createdAtDate
        }
        return workflow + ' at ' + this.createdAtTime
        */
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
