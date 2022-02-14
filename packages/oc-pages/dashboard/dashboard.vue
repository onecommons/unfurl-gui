<script>
import {mapActions, mapGetters} from 'vuex'
export default {
    name: 'Dashboard',
    methods: {
        ...mapActions([
            'loadDashboard'
        ])
    },
    computed: {
        ...mapGetters([
            'isDashboardLoaded'
        ])
    },
    async mounted() {
        await this.loadDashboard()
    }
}
</script>
<template>
<router-view v-if="isDashboardLoaded"/>
</template>
