<template>
  <div id="app">
    <NavBar />
    <router-view class="view"></router-view>
    <!-- <ApolloExample msg="Welcome to Your Vue.js App" /> -->
  </div>
</template>

<script>
// import ApolloExample from "./components/ApolloExample.vue";
// import Demo from "./components/Demo.vue";
import NavBar from "./components/common/NavBar";

export default {
  name: "App",
  components: {
    // Table,
    NavBar
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
