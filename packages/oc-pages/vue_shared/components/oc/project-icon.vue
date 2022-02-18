<script>
export default {
    props: {
        projectIcon: String
    }
}

</script>
<template>
    <img :src="projectIcon">
</template>
<style scoped>

img {
    width: 1.5em;
    height: 1.5em;
    margin-right: 4px;
    border-radius: 25%;
    box-shadow: #595959 0px 1.5px 3px;
}
</style>
