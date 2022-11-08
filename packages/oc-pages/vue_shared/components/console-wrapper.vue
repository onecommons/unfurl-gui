<script>
import {mapMutations, mapActions, mapGetters} from 'vuex'
import {compatibilityMountJobConsole} from 'oc_vue_shared/compat'
const TEXT_HTML = 'text/html' // my editor can't figure out how to indent this string
export default {
    props: {
        jobsData: {
            type: Array,
            required: true
        }
    },
    data() {
        return {
            consoleApp: null,
            timeout: null,
            initialCompletionState: null,
            linesRead: 0,
            autoscroll: true
        }
    },
    computed: {
        ...mapGetters(['getHomeProjectPath, getDashboardItems'])
    },
    methods: {
        ...mapActions(['fetchProjectEnvironments', 'loadDashboard', 'populateDeploymentItems', 'populateJobsList']),
        ...mapMutations(['clearPreparedMutations']),
        async mountJobsConsole() {
            this.consoleApp = compatibilityMountJobConsole()
        },
        async onComplete() {
            await Promise.all([
                this.loadDashboard({fetchPolicy: 'network-only'}),
                this.populateJobsList()
            ])

            await this.populateDeploymentItems(this.$store.getters.getDashboardItems)

            // strange behavior with some state not getting cleaned up before clone
            // https://github.com/onecommons/gitlab-oc/issues/1231
            this.clearPreparedMutations()
        },
        visitJobLogSection(jobLogSection, highestLineNumber=0) {
            if(jobLogSection.content && jobLogSection.lineNumber > highestLineNumber) {
                highestLineNumber = jobLogSection.lineNumber
                for(const contentSection of jobLogSection.content) {
                    //console.log(contentSection.text)
                    //visit here
                }
            }
            else {
                if(jobLogSection.line) {
                    highestLineNumber = Math.max(highestLineNumber, this.visitJobLogSection(jobLogSection.line, highestLineNumber))
                }
                if(jobLogSection.lines) {
                    for(const line of jobLogSection.lines) {
                        highestLineNumber = Math.max(highestLineNumber, this.visitJobLogSection(line, highestLineNumber))
                    }
                }
            }
            return highestLineNumber
        },
        pollLogState(time=30) {
            
            const self = this
            this.timeout = setTimeout(async () => {
                const state = self.consoleApp?.$store?.state
                let complete
                if(!state || (complete = state.job.complete) === undefined) {
                    self.pollLogState(time * 2)
                    return
                }
                switch(self.initialCompletionState) {
                    case 'complete':
                        break
                    case 'incomplete':
                        if(complete) {
                            await self.onComplete()
                        }
                    case null:
                        self.initialCompletionState = complete? 'complete': 'incomplete'
                        if(self.initialCompletionState == 'incomplete') {
                            self.$emit('active-deployment')
                        }

                        break

                }
                const consoleContainer = document.querySelector('#console-container')
                for(const jobLogSection of state.jobLog) {
                    const newConsoleLength = self.visitJobLogSection(jobLogSection, self.linesRead)
                    
                    if(self.autoscroll && newConsoleLength > self.linesRead) {
                        consoleContainer.scrollTop = consoleContainer.scrollHeight - consoleContainer.offsetHeight
                    }
                    self.linesRead = newConsoleLength
                }


                self.pollLogState()
            }, time)
        }
    },
    async beforeCreate() {
        await import('./console-wrapper.css')
    },
    async mounted() {
        const url = this.jobsData[0]?.web_url

        const documentContents = await fetch(url).then(res => res.text())
        const elementMarkup = documentContents.match(/.*js-job-page.*/)[0]
        const tempDocument = (new DOMParser()).parseFromString(elementMarkup, TEXT_HTML)
        const element = tempDocument.querySelector('#js-job-page')
        const dataset = element.dataset
        const consoleContainer = document.querySelector('#console-container')
        consoleContainer.appendChild(element)
        consoleContainer.classList.add('loaded')
        consoleContainer.onscroll = () => {
            const difference = Math.abs(consoleContainer.scrollHeight - consoleContainer.offsetHeight - consoleContainer.scrollTop) 
            this.autoscroll = difference <= 25
        }

        this.mountJobsConsole()
        this.pollLogState()

    },
    beforeUnmount() {
        this.consoleApp.$destory()
        clearTimeout(this.timeout)
    }
}
</script>
<template>
    <div v-pre id="console-container"/>
</template>
<style scoped>
#console-container.loaded {
  max-height: 700px;
  min-height: 100px;
  overflow-y: auto;
}

#console-container >>> a {
    pointer-events: none;
}
</style>
