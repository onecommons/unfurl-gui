<script>
import { GlCard, GlIcon } from '@gitlab/ui';
import OcCard from '../../../project_overview/components/shared/oc_card.vue';

// Renders a list of oc-card children with two perf optimizations:
//
//   1. Lazy mount — in collapsible (wrapped) mode, the cards aren't
//      rendered until the user first opens the section.
//   2. Imperative show/hide — toggling collapse sets style.display on a
//      ref directly, so Vue never re-patches the (potentially huge)
//      nested subtree. Without this, every toggle would cascade through
//      each oc-card's updated() → adaptWidth() → forced reflow.
//
// Each child oc-card is passed :start-collapsed="true" so its content
// subtree isn't mounted until the user expands that specific card.
//
// Usage (wrapped, collapsible, starts closed):
//   <lazy-card-list :cards="cards" :title="__('Hidden Resources')">
//     <template #controls="card"> ... </template>
//     <template #content="card"> ... </template>
//   </lazy-card-list>
//
// Usage (bare, no wrapper, always mounted):
//   <lazy-card-list :cards="cards">
//     ...
//   </lazy-card-list>
export default {
    name: 'LazyCardList',
    components: { GlCard, GlIcon, OcCard },
    props: {
        cards: { type: Array, required: true },
        // When provided, renders the cards inside a collapsible gl-card
        // with this title. When null, cards render bare.
        title: { type: String, default: null },
        // Whether the section starts expanded. Bare mode is always
        // "expanded" (no header to toggle).
        defaultExpanded: { type: Boolean, default: false },
        // Pass-throughs forwarded to every child oc-card.
        displayValidation: { type: Boolean, default: false },
        displayStatus: { type: Boolean, default: false },
        readonly: { type: Boolean, default: false }
    },
    data() {
        const expandedInitially = this.title == null || this.defaultExpanded;
        return {
            expandedVisual: expandedInitially,
            everOpened: expandedInitially
        };
    },
    methods: {
        toggle() {
            const opening = !this.expandedVisual;
            this.expandedVisual = opening;

            if(opening && !this.everOpened) {
                this.everOpened = true;
                this.$nextTick(() => {
                    if(this.$refs.content) this.$refs.content.style.display = '';
                });
                return;
            }
            // Subsequent toggles: pure DOM style change, no Vue re-patch
            // of the (potentially huge) nested subtree.
            if(this.$refs.content) {
                this.$refs.content.style.display = opening ? '' : 'none';
            }
        },

        // Force the section to be visible (e.g. when a hash scroll target
        // must exist in the DOM).
        mountAll() {
            if(!this.everOpened) {
                this.everOpened = true;
                this.expandedVisual = true;
            }
            this.$nextTick(() => {
                if(this.$refs.content) this.$refs.content.style.display = '';
            });
        },

        onChildDelete(payload) {
            this.$emit('deleteNode', payload);
        }
    }
};
</script>
<template>
    <!-- Wrapped (collapsible) mode -->
    <div v-if="title != null" class="row-fluid gl-mb-6 lazy-card-list">
        <gl-card class="oc-card" :header-class="['gl-display-flex', 'header-oc']">
            <template #header>
                <div class="d-flex position-relative w-100 justify-content-between">
                    <div class="d-flex oc-card-header justify-content-between w-100 gl-cursor-pointer" @click="toggle">
                        <div class="align_left gl-display-flex align-items-center flex-one flex-wrap">
                            <div class="d-flex pt-1 pb-1 gl-mr-3">
                                <h4 class="gl-my-0 oc_card_title">{{ title }} ({{ cards.length }})</h4>
                            </div>
                        </div>
                        <div class="d-flex align-items-center">
                            <span class="card-toggle">
                                <gl-icon :name="expandedVisual ? 'chevron-down' : 'chevron-left'" :size="24" />
                            </span>
                        </div>
                    </div>
                </div>
            </template>
            <!-- style is set imperatively in toggle()/mountAll(). Do NOT
                 use :style="..." or v-show here — reactive binding on this
                 div would re-patch the entire nested subtree on every
                 toggle, which cascades oc-card adaptWidth reflows. -->
            <div ref="content" style="display: none;">
                <template v-if="everOpened">
                    <oc-card
                        v-for="card in cards"
                        :key="card.name"
                        :display-validation="displayValidation"
                        :display-status="displayStatus"
                        :readonly="readonly"
                        :card="card"
                        :children="[]"
                        :start-collapsed="true"
                        class="gl-mb-6"
                        @deleteNode="onChildDelete"
                    >
                        <template #controls="slotProps">
                            <slot name="controls" v-bind="slotProps" />
                        </template>
                        <template #content="slotProps">
                            <slot name="content" v-bind="slotProps" />
                        </template>
                    </oc-card>
                </template>
            </div>
        </gl-card>
    </div>

    <!-- Bare mode: no wrapper, cards mount immediately. -->
    <div v-else ref="content" class="lazy-card-list">
        <oc-card
            v-for="card in cards"
            :key="card.name"
            :display-validation="displayValidation"
            :display-status="displayStatus"
            :readonly="readonly"
            :card="card"
            :children="[]"
            :start-collapsed="true"
            class="gl-mb-6"
            @deleteNode="onChildDelete"
        >
            <template #controls="slotProps">
                <slot name="controls" v-bind="slotProps" />
            </template>
            <template #content="slotProps">
                <slot name="content" v-bind="slotProps" />
            </template>
        </oc-card>
    </div>
</template>
<style scoped>
/* Match the padding collapse that primary-card nested children get via
   `.card-content-container >>> .gl-card-body` in oc_card.vue — our
   nested cards aren't inside a card-content-container so they'd
   otherwise pick up the default 16px padding and show as ~32px tall
   empty bodies when collapsed. */
.card-group >>> .oc-card > .gl-card-body,
.lazy-card-list >>> .oc-card > .gl-card-body {
    padding: 0 1em;
}
</style>
