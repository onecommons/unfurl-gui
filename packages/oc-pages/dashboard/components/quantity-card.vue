<script>
export default {
    props: {
        count: Number,
        s: String,
        p: String,
        color: String,
        to: {
            type: Object,
            default: () =>  '#'
        }
    },
    computed: {
        cardCss() {
            return {backgroundColor: this.color}
        },
    }
}

</script>
<template>
    <div class="card-container">
        <router-link :to="to">
            <div class="card" :style="cardCss">
                <span class="count"> {{count}} </span>
                <span class="text"> {{n__(s, p, count)}} </span>
            </div>
        </router-link>
    </div>
</template>

<style scoped>
span {
    font-weight: bold;
    color: #4a5053;
}
span.count {
    font-size: 3.5em;
    margin-bottom: 0.2em;
}
span.text {margin-bottom: 0.4em;}

.card-container >>> a { text-decoration: none !important; }
.card-container {margin: 0.5em 1em;}

.card {
    height: 13em;
    width: 13em;
    border-width: 0; /* not sure why this is necessary */
    border-radius: 1em;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

</style>
