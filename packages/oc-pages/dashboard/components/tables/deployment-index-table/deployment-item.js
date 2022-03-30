export default class DeploymentItem {
    constructor(context) {
        Object.assign(this, context)
    }

    get pipeline() {
        return this.deployPath?.pipeline
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

    get consoleLink() {
        if(this.projectPath && this.job) {
            return `/${this.projectPath}/-/jobs/${this.job.id}`
        }
    }

    get createdAtDate() { return this.createdAt?.toLocaleDateString() }
    get createdAtTime() { return this.createdAt?.toLocaleTimeString() }
    get createdAtText() {
        if(!this.createdAt) return 
        const today = (new Date(Date.now())).getDate() 
        const workflow = this.pipelineWorkflow == 'undeploy'? 'Undeployed': 'Deployed'
        if(this.createdAt.getDate() != today) {
            return workflow + ' on ' + this.createdAtDate
        }
        return workflow + ' at ' + this.createdAtTime
    }
    get isDraft() {
        return this.deployment.__typename == 'DeploymentTemplate' && this.pipeline === undefined
    }
    get isUndeployed() {
        return this.deployment.__typename == 'Deployment' && !this.isDeployed
    }
    get isDeployed() {
        return this.deployment.__typename == 'Deployment' && this.deployment.statuses?.every(rt => {
            return rt?.status != 5 && rt?.status != 3
        })
    }
}
