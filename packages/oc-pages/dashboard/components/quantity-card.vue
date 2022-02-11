<script>
export default {
    props: {
        count: Number,
        text: String,
        color: String
    },
    computed: {
        outerCss() {
            return {backgroundColor: this.color}
        },
    }
}

</script>
<template>
    <div :style="outerCss">
        <span class="count"> {{count}} </span>
        <span> {{text}} </span>
    </div>
</template>

<style scoped>
span {
    color: #4a5053;
}

span {
    font-weight: bold;
}
span.count {
    font-size: 3.5em;
    margin-bottom: 0.2em;
}

div {
    cursor: default;
    height: 12em;
    width: 12em;
    border-radius: 1em;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

</style>
