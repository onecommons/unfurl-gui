<script lang="ts">
import {defineComponent} from 'vue'
import {notFoundError, removeNotFoundError} from 'oc_vue_shared/client_utils/error'

export default defineComponent({
  name: 'PageNotFound',
  created: notFoundError,
  unmounted: removeNotFoundError
})
</script>
<template>
  <div/>
</template>
