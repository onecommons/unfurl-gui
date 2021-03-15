<template>
  <div class="row-fluid mt-4">
    <pre>
      Views
      * User home
        - Contexts: Connections, secrets, etc.
        - Cloud accounts / organizations (or just instances?)
        - Repos: (projects, deployment, plain/source code, ensembles?)
      * Notification/Inbox pane: Review upstream updates, Status changes, Other alerts
      * MyCloud view -- ensembles, instances, jobs, artifacts/source
      * Project view -- replaces readme in project repo? basically the same as user home plus ensembles
      * Plaform home: including the whole cloud
      * browse/search for available public ensembles / services to clone or connect to
    </pre>
    <Demo name="demo" />
  </div>
</template>
<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import Demo from "../components/Demo.vue";

@Component({
  components: {
    Demo
  }
})
export default class Home extends Vue {}
</script>
