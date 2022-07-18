import axios from '~/lib/utils/axios_utils'

export const AUTHENTICATED = 1
export const UNAUTHENTICATED = 2

export const DISABLED=0
export const AVAILABLE=1
export const PENDING=2
export const IMPORTED=3


export const oauthStatus = {
    AUTHENTICATED,
    UNAUTHENTICATED,
}

export const importStatus = {
    DISABLED, PENDING, AVAILABLE, IMPORTED
}

let pollIntervalHandle

class GithubImport {
    constructor(repo) {
        Object.assign(this, repo)
    }

    get importStatus() {
        switch(this.import_status) {
            case 'finished': return importStatus.IMPORTED
            case 'started': return importStatus.PENDING
            case 'scheduled': return importStatus.PENDING
            default: return this.import_status || importStatus.AVAILABLE
        }
    }

    pollChanges(period=1000) {
        if(pollIntervalHandle) {clearInterval(pollIntervalHandle)}

        const self = this
        this.pollPromise = new Promise((resolve, reject) => {
            pollIntervalHandle = setInterval(async () => {
                const changes = (await axios.get('/import/github/realtime_changes.json')).data
                self.import_status = changes.find(change => self.id == change.id).import_status

                if(self.import_status == 'finished') {
                    resolve()
                    clearInterval(pollIntervalHandle)
                }
            }, period)
        })
    }

    async importSelf(target_namespace) {
        const response = await axios.post('/import/github.json', {target_namespace, new_name: this.sanitized_name, ci_cd_only: false, repo_id: this.externalId})

        Object.assign(this, response.data)
        this.import_status = this.import_status

        this.pollChanges()
    }
}

export class GithubImportHandler {
    constructor(data) {
        this.status = 0
        this.imported_projects = []
        this.incompatible_repos = []
        this.provider_repos = []
        this.repos = []
        if(data) {
            this.status = AUTHENTICATED
            Object.assign(this, data)
            this.mapRepos()
        }
    }

    mapRepos() {
        const byProviderLink = {}
        for(const repo of this.provider_repos) {
            byProviderLink[repo.provider_link] = {
                ...repo,
                externalName: repo.full_name,
                externalId: repo.id,
                import_status: null
            }
        }
        for(const project of this.imported_projects) {
            byProviderLink[project.provider_link] = {
                ...byProviderLink[project.provider_link],
                ...project
            }
        }
        this.repos = Object.values(byProviderLink).map(repo => new GithubImport(repo))
    }

    loadRepos() {
        async function loadReposInner() {
            try {
                const result = await axios.get('/import/github/status.json')
                console.log(result)
                if(result.status < 300) {
                    this.status = AUTHENTICATED
                    Object.assign(this, result.data)
                    this.mapRepos()
                }
            } catch(e) {
                console.error(e)
                if(e.request.status === 0) {
                    this.status = UNAUTHENTICATED
                    // CORS redirect
                } else {
                    console.log(Object.entries(e))
                }
            }
        }

        const promise = loadReposInner.apply(this)
        this.loadReposPromise = promise

        return promise
    }

    async listRepos() {
        await this.loadReposPromise
        return this.repos
    }

    findRepo(externalName) {
        return this.repos.find(repo => repo.externalName == externalName)
    }

    getImportStatus(externalName) {
        return this.findRepo(externalName)?.importStatus
    }

    async importRepo(externalName) {
        return await this.findRepo(externalName).importSelf() 
    }
}
