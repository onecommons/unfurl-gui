<script>
import {mapGetters} from 'vuex'
export default {
    name: 'DashboardWelcome',
    data() {
        return {
            greetingName: window.gon.greetingName || window.gon.current_user_fullname
        }
    },
    computed: {
        ...mapGetters(['getCurrentNamespace', 'getHomeProjectName', 'getUsername', 'getHomeProjectPath', 'userCanEdit']),
        message() {
            if(this.getCurrentNamespace == this.getUsername && this.getHomeProjectName.toLowerCase() == 'dashboard') {
                return 'You haven’t deployed anything yet.'
            }
            return `You haven't deployed anything to ${this.getHomeProjectPath} yet.`

        }
    }
}
</script>
<template>
    <div v-if="userCanEdit" class="greeting">

        <div class="greeting-text">
            Hi, {{greetingName}}
        </div>

        <div class="wcard">
            <div class="instructions">
                {{message}} <br>
                Browse our <a href="/explore/blueprints">Cloud Blueprints</a> and refer to our <a href="/help">help guides</a> to get started.
            </div>
        </div>
    </div>
</template>
<style scoped>
.greeting {
    width: 100%;
    font-weight: bold;
    margin-top: 3em;
}
.greeting-text {
    font-size: 3em;
    line-height: 1.2;
    margin-bottom: 1em;
    margin-top: 0.5em;
}
.instructions {
    font-size: 2em;
    line-height: 1.8125;
    max-width: 40rem;
}
.greeting > * {
    padding-left: 2.625rem;
}
.wcard {
    padding-top: 1em;
    margin: 0.5em;
    padding-bottom: 1em;
    border-radius: 10px;
    margin-bottom: 4.5em;
}
.greeting {
    color: #4A5053;
}
.gl-dark .greeting {
    color: #FFFFFFDD;
}
.wcard {
    background-color: #EDFCFA;
}
.gl-dark .wcard {
    background-color: #123233;
}
a { color: #0099FF; }
a:hover { opacity: 0.8; }


</style>
