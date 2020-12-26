<template>
  <div class="ensemble">
    <details>
      <summary>
        <span class="actions">(Fork | Login | Connect | Deploy/Update | More...)</span>
        {{ name }}
        <div class="summaryindent">{{ domain }}</div>
      </summary>
      <table>
        <tr>
          <td>Type</td>
          <td>tosca:Compute</td>
        </tr>
        <tr>
          <td>Status</td>
          <td>OK</td>
        </tr>
      </table>
      <p>Public Endpoints</p>
      <p>Inputs / Outputs</p>
      <details class="external">
        <summary>External Ensembles/Dependencies</summary>
        <div class="child">
          <ul>
            <li>DB <span class="actions">(Find Matches)</span></li>
            <li>Mailer <span class="actions">(Find Matches)</span></li>
          </ul>
        </div>
      </details>
      <details class="workflows">
        <summary>Workflows</summary>
        <div class="child">
          <ul>
            <li>Backup</li>
            <li>Validate</li>
          </ul>
        </div>
      </details>
      <details open class="instances">
        <summary>Instances</summary>
        <div class="child">
          <Instance name="Instance1" />
          <Instance name="Instance2" />
        </div>
      </details>
    </details>
  </div>
</template>

<script>
import * as GlComponents from "@gitlab/ui";
import Instance from "./Instance.vue";

export default {
  name: "Ensemble",
  props: {
    name: String,
    domain: String
  },
  components: {
    Instance,
    ...GlComponents,
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
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