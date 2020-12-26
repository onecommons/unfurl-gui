<template>
  <div class="instance">
    <details>
      <summary>{{ name }}</summary>
      <div class="child">
        <table>
          <tr>
            <td>Type</td>
            <td>tosca:Compute</td>
          </tr>
          <tr>
            <td>Status</td>
            <td>OK</td>
          </tr>
          <tr>
            <td>prop1</td>
            <td>value</td>
          </tr>
        </table>
        <details>
          <summary>Dependencies</summary>
          <div class="child">
            <ul>
              <li>job</li>
              <li>job</li>
              <li>job</li>
              <li>job</li>
            </ul>
          </div>
        </details>
        <details>
          <summary>Endpoints</summary>
          <div class="child">
            <ul>
              <li>job</li>
              <li>job</li>
              <li>job</li>
              <li>job</li>
            </ul>
          </div>
        </details>
        <details>
          <summary>Artifacts</summary>
          <div class="child">
            <ul>
              <li>job</li>
              <li>job</li>
              <li>job</li>
              <li>job</li>
            </ul>
          </div>
        </details>
        <details>
          <summary>Revisions</summary>
          <div class="child">
            <ul>
              <li>job</li>
              <li>job</li>
              <li>job</li>
              <li>job</li>
            </ul>
          </div>
        </details>
      </div>
    </details>
  </div>
</template>

<script>
import * as GlComponents from "@gitlab/ui";
export default {
  name: "Instance",
  props: {
    name: String
  },
  components: {
    ...GlComponents
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.ensemble {
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
