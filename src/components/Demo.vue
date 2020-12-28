<template>
  <div class="panel">
    <div>
        <b>{{ name }}</b> <span class="actions">(New | Project)</span>
    </div>
    <div>
        SPEC/Template view goes here
    </div>
    <Ensemble name="Ensemble1" domain="example-domain.com" />
    <Ensemble name="Ensemble2" domain="staging.example-domain.com" />
  </div>
</template>

<script>
import * as GlComponents from "@gitlab/ui";
import Ensemble from "./Ensemble.vue";

export default {
  name: "Demo",
  props: {
    name: String
  },
  components: {
    Ensemble,
    ...GlComponents
  }
};

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
  .panel {
    background: lightgrey;
    width: 500px;
  }
  .summaryindent {
    margin-left: 20px;
  }

  .child {
    margin-left: 50px;
  }
  .actions {
    float: right;
    background: yellow;
    color: grey;
  }
</style>