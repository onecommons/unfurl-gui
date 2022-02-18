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
    <!-- forgive me -->
    <div style="font-size: 0.9em;">
        <router-view v-if="isDashboardLoaded"/>
    </div>
</template>
