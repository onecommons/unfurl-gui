<template>
  <div class="ensemble">
    <details>
      <summary>
        <span class="actions"
          >(Fork | Login | Connect | Deploy/Update | More...)</span
        >
        {{ name }}
        <div class="summaryindent">{{ domain }}</div>
      </summary>
      <DataTable :items="items" />
      <!-- 
        It's not obvious how to pass a component as prop as item within array 
        (in this case the Status component as an item in the DataTable).
        After a few tries, I don't think I can waste more time figuring this out...
        See https://stackoverflow.com/a/42998087 for Vue syntax on passing components as props.
      -->
      <Status :status="currentStatus" />
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
import Status from "./Status.vue";
import Instance from "./Instance.vue";
import DataTable from "./DataTable.vue";

export default {
  name: "Ensemble",
  props: {
    name: String,
    domain: String
  },
  data() {
    return {
      currentStatus: "ok",
      items: [
        { row: "Type", content: "tosca:Compute" },
        { row: "Status", content: this.currentStatus }
      ]
    };
  },
  components: {
    Instance,
    Status,
    DataTable,
    ...GlComponents
  }
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
