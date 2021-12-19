<template>
  <div id="app">
      <MainBody></MainBody>
  </div>
</template>

<script>
export default {
  name: "Layout",
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
