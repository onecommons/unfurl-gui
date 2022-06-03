<script>
import {GlIcon} from '@gitlab/ui'

export default {
    name: 'Redacted',
    components: {
        GlIcon
    },
    props: {
        value: {
            type: String,
            required: true
        }
    },
    data() {
        return {
            isHidden: true
        }
    },
    methods: {
        toggle() {
            this.isHidden = !this.isHidden
        }
    }
}
</script>

<template>
    <div class="redacted-container">
        <div v-if="value">
            <span v-if="isHidden"> {{value.replace(/./g, '*')}}</span>
            <span v-else>{{ value }}</span>
        </div>
        <gl-icon @click="toggle" :name="isHidden ? 'eye' : 'eye-slash'" style="cursor: pointer"/>
    </div>
</template>

<style scoped>
.redacted-container {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
}

</style>
