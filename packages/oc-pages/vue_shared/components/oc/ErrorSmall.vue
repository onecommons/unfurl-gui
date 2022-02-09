<!-- taken from project_overview/templates for global use -->
<script>
export default {
    props: {
        condition: {
            default() {return true}
        },
        message: String
    }
}
</script>
<template>
    <small v-if="condition && message" class="alert-input">{{ __(message) }}</small>
</template>
<style>
.alert-input {
    margin: 0.5em;
    display: block;
    color: #EC5941;
    font-weight: 700;
}
</style>
