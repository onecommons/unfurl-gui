<script>
import { GlIcon } from '@gitlab/ui'

export default {
    name: 'FileTree',
    // ignored by vue 2, but keeps select off the root element's native listeners under vue 3
    emits: ['select'],
    components: {GlIcon},
    props: {
        // {id, text, selectable, checkable, expandable, nodes, state: {expanded}}
        nodes: {type: Array, required: true},
        // selection is single and owned by the parent - null when nothing is selected
        selected: {type: String, default: null},
    },
    data() {
        const expanded = {}
        this.nodes.forEach(node => {expanded[node.id] = !!node.state?.expanded})
        return {expanded}
    },
    methods: {
        isExpandable(node) {
            return node.expandable && node.nodes?.length > 0
        },

        // the root row is neither selectable nor expandable and shows no icon
        iconName(node) {
            if(node.selectable) return 'doc-text'
            if(!node.expandable) return null
            return this.expanded[node.id]? 'folder-open': 'folder-o'
        },

        toggleExpanded(node) {
            this.expanded = {...this.expanded, [node.id]: !this.expanded[node.id]}
        },

        toggleSelected(node) {
            this.$emit('select', node.id == this.selected? null: node.id)
        },

        clickRow(node) {
            if(this.isExpandable(node)) {
                this.toggleExpanded(node)
            } else if(node.selectable) {
                this.toggleSelected(node)
            }
        }
    }
}
</script>
<template>
    <ul class="file-tree">
        <li v-for="node in nodes" :key="node.id" :data-id="node.id" data-testid="file-tree-node">
            <div class="file-tree-row" @click="clickRow(node)">
                <!-- gated on isExpandable, not on being a folder: an empty one
                     looks identical otherwise and clicking it does nothing -->
                <span class="file-tree-chevron">
                    <gl-icon v-if="isExpandable(node)" :name="expanded[node.id]? 'chevron-down': 'chevron-right'" :size="12"/>
                </span>
                <!-- always rendered so rows line up when only some of them are checkable -->
                <span class="file-tree-check">
                    <!-- prevent so the checkbox only ever reflects the selected prop -->
                    <input v-if="node.checkable" type="checkbox" :checked="node.id == selected" @click.stop.prevent="toggleSelected(node)">
                </span>
                <gl-icon v-if="iconName(node)" :name="iconName(node)" :size="16" class="file-tree-icon" :class="{'file-tree-file-icon': node.selectable, selected: node.id == selected}"/>
                <span class="file-tree-text" :class="{selected: node.id == selected}">{{node.text}}</span>
            </div>
            <file-tree v-if="node.nodes && expanded[node.id]" :nodes="node.nodes" :selected="selected" @select="$emit('select', $event)"/>
        </li>
    </ul>
</template>
<style scoped>
.file-tree {
    list-style: none;
    padding: 0;
    margin: 0;
}

.file-tree .file-tree {
    padding-left: 10px;
}

.file-tree-row {
    display: flex;
    align-items: center;
    height: 30px;
    width: 340px;
    max-width: 100%;
    cursor: pointer;
}

.file-tree-chevron {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    margin-right: 4px;
    fill: currentColor;
}

.file-tree-check {
    flex: none;
    display: inline-flex;
    align-items: center;
    width: 16px;
    margin-right: 6px;
}

.file-tree-check > input {
    margin: 0;
}

.file-tree-icon {
    flex: none;
    margin-right: 6px;
    fill: currentColor;
}

.file-tree-file-icon {
    color: #007AD5;
}

.file-tree-icon.selected {
    color: #2ECC71;
}

.file-tree-text {
    flex: 1;
    min-width: 0;

    /* copied from .text-monospace */
    font-family: "Menlo", "DejaVu Sans Mono", "Liberation Mono", "Consolas", "Ubuntu Mono", "Courier New", "andale mono", "lucida console", monospace;
    font-size: 14px;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
}

.file-tree-text.selected {
    font-weight: bold;
    color: #2ECC71;
}
</style>
