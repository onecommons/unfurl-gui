<script>
import {notFoundError, removeNotFoundError} from 'oc_vue_shared/client_utils/error.js'

export default {
  name: 'PageNotFound',
  created: notFoundError,
  unmounted: removeNotFoundError
}
</script>
<template>
  <div/>
</template>
