<script>
import {mapGetters} from 'vuex'
export default {
    name: 'OcPropertiesList',
    props: {
        card: {
            type: Object,
            required: true
        },
        property: String, // TODO validate to only except inputs and outputs
        containerStyle: Object
    },
    computed: {
        ...mapGetters([
        ]),
        properties() {
            const properties = this.card?.template?.properties || this.card.properties
            return properties
        }
    },
}

</script>
<template>

    <div style="max-width: 100%; overflow-x: auto;">
        <div :style="containerStyle" class="properties-list-container">
            <div class="properties-list-item" v-for="property in properties" :key="property.name">
                <div class="name-column">{{property.name}}</div>
                <div class="value-column">{{property.value}}</div>
            </div>
        </div>
    </div>

</template>

<style scoped>

.properties-list-container {
    border-radius: 4px;
    background-color: white;
    border-color: #d8d8d8;
    border-style: solid;
    border-width: 2px;
    display: inline-block;
}
.properties-list-item {
    display: flex;
    margin: -1px;
    min-width: 22em;
}
.name-column, .value-column {
    padding: 0.75em;
    border-width: 2px;
    border-color: #d8d8d8;
    border-top-style: inherit;
}
.properties-list-item:nth-child(n+2) {
    border-top-style: solid;
    border-width: 0;
}
.name-column {
    font-weight: bold;
    background: #f4f4f4;
    width: 10em;
    border-top-color: white;
    border-right-style: solid;
    color: #585d60;
}
.value-column {
    width: calc(100% - 10em);
    padding-left: 3em; padding-right: 3em;
    color: #666666;
    border-color: #eeeeee;
}
</style>
