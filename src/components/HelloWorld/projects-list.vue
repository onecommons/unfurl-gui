<script>
import axios from '~/lib/utils/axios_utils'
export default {
  name: "ProjectList",
  data() {
    return {
      projectPaths: []
    }
  },
  async mounted() {
    const response = await axios.get('/proxied/project-paths')
    this.projectPaths = response?.data?.projectPaths || []
  }
}
</script>
<template>
  <ul>
    <li :key="projectPath" v-for="projectPath in projectPaths">
      <a :href="`/${projectPath}`">{{projectPath}}</a>
    </li>
  </ul>
</template>
