<script>
import {CodeClipboard} from 'oc_vue_shared/components/oc'
import { mapGetters } from 'vuex';
export default {
    name: 'LocalDevelop',
    components: {
        CodeClipboard
    },
    data() {},
    computed: {
        ...mapGetters(['getGlobalVars']),
        cloneURL() {
            return `${window.location.origin}/${this.getGlobalVars.projectPath}`
        },
        likelyClonePath() {
            return this.getGlobalVars.projectPath.split('/').pop()
        },
        serveCommand() {
            return [
                'env',
                `UNFURL_CLOUD_SERVER=${window.location.origin}`,
                'unfurl serve',
                `--cors ${window.location.origin}`,
                this.likelyClonePath
            ].join(' ')
        }
    }
}
</script>
<template>
    <div>
        <p> Run these shell commands to start an Unfurl Server development session locally on your machine: </p>
        <p>
            Install Unfurl if needed:
            <code-clipboard class="mt-2">python -m pip install -U unfurl</code-clipboard>
        </p>
        <p>
            Clone this Unfurl project if you haven't already:
            <code-clipboard class="mt-2">git clone '{{cloneURL}}'</code-clipboard>
            (Or if you have, run "git pull" to get latest.)
        </p>
        <p>
            Run <code>unfurl serve</code>:
            <code-clipboard class="mt-2">{{serveCommand}}</code-clipboard>
        </p>

        <p>
            After following the instructions provided by the serve command, changes made to the blueprint's ensemble template will be reflected on this page upon refreshing.
        </p>
        <p>
            Deployments and deployment drafts may be created using while using Unfurl Server locally, but you will need to deploy them locally as well.
        </p>
        <p>Learn more at <a href="https://github.com/onecommons/unfurl" target="_blank">https://github.com/onecommons/unfurl</a>.</p>
    </div>
</template>
