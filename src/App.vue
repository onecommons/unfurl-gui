<template>
  <div id="app">
  <pre>Views
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
Ensemble View
    <Demo name="demo" />
    <!-- <ApolloExample msg="Welcome to Your Vue.js App" /> -->
  </div>
</template>

<script>
// import ApolloExample from "./components/ApolloExample.vue";
import Demo from "./components/Demo.vue";

export default {
  name: "App",
  components: {
    Demo
  }
};
</script>

<style>
/* 
  https://gitlab.com/gitlab-org/gitlab-ui/-/blob/master/doc/css.md
    NOTE: "simple import" actually needs tilde ~ before module path as per
    https://stackoverflow.com/questions/55933835/cannot-import-stylesheets-from-node-modules-without-tilde 
*/
@import "~@gitlab/ui/dist/index.css";
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin: 4rem;
}
</style>
