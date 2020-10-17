<template>
  <div id="app">
    <formTest />
    <img alt="Vue logo" src="./assets/logo.png" />
    <ApolloExample msg="Welcome to Your Vue.js App" />
  </div>
</template>

<script>
import ApolloExample from "./components/ApolloExample.vue";
import formTest from "./components/test.vue";

export default {
  name: "App",
  components: {
    ApolloExample,
    formTest
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
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
