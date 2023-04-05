<script>
import {mapGetters} from 'vuex'
export default {
    props: {
        count: Number,
        s: String,
        p: String,
        color: String,
        to: {
            type: Object,
            default: () =>  '#'
        },
        secondaryLink: [String, Object],
        secondaryLinkText: {
            type: String,
            default: () => '+ Create New'
        },
        secondaryLinkRequiresEdit: {
            type: Boolean,
            default: true
        }

    },
    computed: {
        ...mapGetters(['userCanEdit']),
        cardCss() {
            return {backgroundColor: this.color}
        },
        secondaryLinkProps() {
            if(typeof this.secondaryLink == 'string') return {href: this.secondaryLink}
            return {to: this.secondaryLink}
        },
        showSecondaryLink() {
            if(this.secondaryLinkRequiresEdit && !this.userCanEdit) return false

            return !!this.secondaryLink
        }
    }
}

</script>
<template>
    <div class="card-container">
        <router-link :to="to">
            <div class="card" :style="cardCss">
                <span class="count"> {{count}} </span>
                <span class="text"> {{n__(s, p, count)}} </span>
                <div style="height: 1em; margin-top: -0.5em; font-weight: 500;">
                    <component :is="typeof secondaryLink == 'string'? 'a': 'router-link'" v-if="showSecondaryLink" @click="e => e.stopPropagation()" v-bind="secondaryLinkProps">
                        {{secondaryLinkText}}
                    </component>
                </div>
            </div>
        </router-link>
    </div>
</template>

<style scoped>

span.count {
    font-size: 3.5em;
    margin-bottom: 0.2em;
}
span.text {margin-bottom: 0.4em;}

.card-container >>> a { text-decoration: none !important; }
.card-container {margin: 0.5em 1em;}
.count {font-weight: bold}

.card {
    padding-top: 0.5em;
    height: 13em;
    min-width: 13em;
    border-width: 0; /* not sure why this is necessary */
    border-radius: 1em;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #4a5053;
    font-weight: 600;
}
@media only screen and (max-width: 768px) {
    .card {
        width: 70vw;
        height: unset;
        padding-bottom: 1.2em;
    }
    span.count {
        line-height: 1;
        font-size: 4.5em;
        margin-bottom: 0;
    }
    span.text {margin-bottom: 0.2em;}

}

.card >>> a, .card a { text-decoration: underline !important; }

</style>
