<script>
import {mapActions, mapGetters} from 'vuex'
export default {
    name: 'Dashboard',
    methods: {
        ...mapActions([
            'loadDashboard',
            'handleResize'

        ])
    },
    computed: {
        ...mapGetters([
            'isDashboardLoaded'
        ])
    },
    async mounted() {
        await this.loadDashboard()
        this.handleResize()

    }
}
</script>
<template>
    <!-- forgive me -->
    <div style="font-size: 0.95em;">
        <router-view v-if="isDashboardLoaded"/>
    </div>
</template>
