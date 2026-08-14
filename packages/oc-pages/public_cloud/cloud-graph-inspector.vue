<script>
import { GlBadge, GlCard } from '@gitlab/ui'

const SECTION_FOR_KIND = {
  Repository: 'Repositories',
  Artifact: 'Artifacts',
  Instantiation: 'Instantiations',
  Service: 'Services',
  Type: 'Types',
}

function relationEntriesToItems(entries) {
  return (entries || []).map((entry, index) => {
    const normalized = typeof entry === 'string' ? { type: entry } : entry
    return {
      ...normalized,
      _id: `${normalized.url || normalized.type || normalized.label || 'entry'}-${index}`,
    }
  })
}

export default {
  name: 'CloudGraphInspector',
  components: {
    GlBadge,
    GlCard,
  },
  props: {
    graph: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      expanded: {},
      selectedUrl: '',
      selectedKind: '',
    }
  },
  computed: {
    overviewUrl() {
      return this.graph.roots?.[0]?.url || ''
    },
    isOverview() {
      return !this.selectedUrl
    },
    overviewNodes() {
      return (this.graph.roots || []).map((root, index) => ({
        ...root,
        _id: `${root.url || 'root'}-${root.kind || 'kind'}-${index}`,
        node: this.nodeFor(root.url, root.kind),
      }))
    },
    availableKinds() {
      return (this.graph.roots || [])
        .filter(root => root.url === this.selectedUrl)
        .map(root => root.kind)
    },
    selectedNode() {
      if(!this.selectedUrl || !this.selectedKind) return null
      const section = this.graph.sections?.[SECTION_FOR_KIND[this.selectedKind]]
      return section?.[this.selectedUrl] || null
    },
    relationGroups() {
      const rels = this.selectedNode?.rels || {}
      return Object.entries(rels).map(([label, entries]) => ({
        label,
        entries: relationEntriesToItems(entries),
      }))
    },
    selectedMeta() {
      const typeRef = this.selectedNode?.type_refs?.[0]
      return typeRef?.type || this.selectedNode?.kind || this.selectedKind
    },
  },
  created() {
    this.restoreFromLocation()
    window.addEventListener('popstate', this.onPopState)
  },
  beforeDestroy() {
    window.removeEventListener('popstate', this.onPopState)
  },
  methods: {
    stateFor(url, kind) {
      return { selectedUrl: url, selectedKind: kind || '' }
    },
    selectUrl(url, kind = '') {
      const nextKind = kind || this.kindForUrl(url) || this.selectedKind
      if(!url || !nextKind) return

      this.selectedUrl = url
      this.selectedKind = nextKind
      window.history.pushState(
        this.stateFor(url, nextKind),
        '',
        `#graph=${encodeURIComponent(url)}`
      )
    },
    onPopState(event) {
      const state = event.state
      if(state?.selectedUrl) {
        this.selectedUrl = state.selectedUrl
        this.selectedKind = state.selectedKind || this.kindForUrl(state.selectedUrl) || this.selectedKind
        return
      }

      this.restoreFromLocation()
    },
    restoreFromLocation() {
      const hash = window.location.hash || ''
      const match = hash.match(/graph=([^&]+)/)
      if(!match) {
        this.selectedUrl = ''
        this.selectedKind = ''
        return
      }

      const url = decodeURIComponent(match[1])
      this.selectedUrl = url
      this.selectedKind = this.kindForUrl(url)
    },
    nodeFor(url, kind) {
      if(!url || !kind) return null
      const section = this.graph.sections?.[SECTION_FOR_KIND[kind]]
      return section?.[url] || null
    },
    kindForUrl(url) {
      const matches = []
      Object.entries(this.graph.sections || {}).forEach(([_sectionName, nodes]) => {
        const node = nodes?.[url]
        if(node?.kind) matches.push(node.kind)
      })
      if(matches.includes(this.selectedKind)) return this.selectedKind
      if(matches[0]) return matches[0]

      const rootMatch = (this.graph.roots || []).find(root => root.url === url)
      return rootMatch?.kind || ''
    },
    relationGroupsFor(node) {
      const rels = node?.rels || {}
      return Object.entries(rels).map(([label, entries]) => ({
        label,
        entries: relationEntriesToItems(entries),
      }))
    },
    metaFor(node, kind) {
      const typeRef = node?.type_refs?.[0]
      return typeRef?.type || node?.kind || kind || ''
    },
    itemKind(item) {
      if(item.kind) return item.kind
      if(item.type && this.graph.sections?.Types?.[item.type]) return 'Type'
      return ''
    },
    itemMeta(item) {
      if(item.type_refs?.length) {
        const typeRef = item.type_refs[0]
        const version = typeRef.constraints?.version
        return version ? `${typeRef.type} v${version}` : typeRef.type
      }
      return item.type || item.kind || ''
    },
    itemLabel(item) {
      return item.label || item.url || item.type || ''
    },
    itemTargetUrl(item) {
      if(item.missing) return ''
      if(item.url) return item.url
      if(item.type && this.graph.sections?.Types?.[item.type]) return item.type
      return ''
    },
    toggleGroup(label) {
      this.$set(this.expanded, label, !this.isExpanded(label))
    },
    isExpanded(label) {
      return this.expanded[label] !== false
    },
  },
}
</script>

<template>
  <gl-card class="cloud-graph-inspector ml-5 mr-5">
    <template #header>
      <div class="inspector-head">
        <div>
          <div class="inspector-kicker">Cloud Graph Inspector</div>
          <div class="title-row">
            <h2 class="inspector-title" :class="{ 'overview-title': isOverview }">{{ isOverview ? overviewUrl : (selectedKind || 'Record') }}</h2>
            <gl-badge v-if="!isOverview && selectedMeta" variant="info">{{ selectedMeta }}</gl-badge>
            <gl-badge v-if="!isOverview && availableKinds.length > 1">{{ availableKinds.join(' / ') }}</gl-badge>
          </div>
        </div>
      </div>
    </template>

    <div class="inspector-body">
      <div v-if="isOverview" class="relation-stack">
        <div
          v-for="root in overviewNodes"
          :key="root._id"
          class="relation-group"
        >
          <button class="group-toggle" @click="toggleGroup(root._id)">
            <span class="group-caret">{{ isExpanded(root._id) ? '▾' : '▸' }}</span>
            <span class="group-label">{{ root.kind }}</span>
            <span v-if="metaFor(root.node, root.kind)" class="group-kind-meta">{{ metaFor(root.node, root.kind) }}</span>
          </button>

          <div v-if="isExpanded(root._id)" class="group-body">
            <div
              v-for="group in relationGroupsFor(root.node)"
              :key="`${root._id}-${group.label}`"
              class="subgroup"
            >
              <button class="subgroup-toggle" @click="toggleGroup(`${root._id}-${group.label}`)">
                <span class="group-caret">{{ isExpanded(`${root._id}-${group.label}`) ? '▾' : '▸' }}</span>
                <span class="group-label">{{ group.label }}</span>
                <span class="group-count">{{ group.entries.length }}</span>
              </button>

              <div v-if="isExpanded(`${root._id}-${group.label}`)" class="group-body">
                <component
                  v-for="item in group.entries"
                  :key="item._id"
                  :is="itemTargetUrl(item) ? 'button' : 'div'"
                  class="node-row"
                  :class="{ clickable: !!itemTargetUrl(item) }"
                  @click="itemTargetUrl(item) && selectUrl(itemTargetUrl(item), itemKind(item))"
                >
                  <div class="node-main">
                    <span class="node-label">{{ itemLabel(item) }}</span>
                  </div>
                  <div class="node-meta">
                    <span v-if="itemMeta(item)" class="node-type">{{ itemMeta(item) }}</span>
                    <span v-if="item.missing" class="node-state missing">Missing</span>
                  </div>
                </component>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template v-else>
        <div class="focus-header">
          <button class="focus-url" @click="selectUrl(selectedUrl, selectedKind)">
            {{ selectedUrl }}
          </button>
        </div>

        <div class="relation-stack">
          <div v-for="group in relationGroups" :key="group.label" class="relation-group">
            <button class="group-toggle" @click="toggleGroup(group.label)">
              <span class="group-caret">{{ isExpanded(group.label) ? '▾' : '▸' }}</span>
              <span class="group-label">{{ group.label }}</span>
              <span class="group-count">{{ group.entries.length }}</span>
            </button>

            <div v-if="isExpanded(group.label)" class="group-body">
              <component
                v-for="item in group.entries"
                :key="item._id"
                :is="itemTargetUrl(item) ? 'button' : 'div'"
                class="node-row"
                :class="{ clickable: !!itemTargetUrl(item) }"
                @click="itemTargetUrl(item) && selectUrl(itemTargetUrl(item), itemKind(item))"
              >
                <div class="node-main">
                  <span class="node-label">{{ itemLabel(item) }}</span>
                </div>
                <div class="node-meta">
                  <span v-if="itemMeta(item)" class="node-type">{{ itemMeta(item) }}</span>
                  <span v-if="item.missing" class="node-state missing">Missing</span>
                </div>
              </component>
            </div>
          </div>
        </div>
      </template>
    </div>
  </gl-card>
</template>

<style scoped>
.cloud-graph-inspector {
  height: 100%;
}

.cloud-graph-inspector >>> .gl-card-body {
  height: 100%;
  padding: 0;
}

.inspector-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.inspector-kicker {
  color: #247b7d;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.inspector-title {
  margin: 0.15rem 0 0;
  font-size: 1.45rem;
}

.overview-title {
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
  font-family: var(--default-mono-font, monospace);
  overflow-wrap: anywhere;
}

.inspector-body {
  padding: 0.75rem 0.9rem 1rem;
  background: rgba(255, 255, 255, 0.84);
}

.focus-header {
  margin-bottom: 0.7rem;
}

.focus-url {
  display: block;
  width: 100%;
  border: 1px solid rgba(36, 123, 125, 0.16);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(248, 252, 252, 0.98), rgba(255, 255, 255, 0.98));
  color: #1d4ed8;
  font-family: var(--default-mono-font, monospace);
  font-size: 0.88rem;
  padding: 0.65rem 0.8rem;
  text-align: left;
  overflow-wrap: anywhere;
}

.focus-url:hover {
  color: #0f766e;
}

.relation-stack {
  display: grid;
  gap: 0.65rem;
}

.relation-group {
  border: 1px solid rgba(36, 123, 125, 0.12);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.group-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border: 0;
  background: rgba(239, 252, 252, 0.92);
  padding: 0.6rem 0.8rem;
  text-align: left;
}

.group-label {
  font-weight: 700;
  color: #0f172a;
  font-size: 0.9rem;
}

.group-caret {
  color: #247b7d;
  font-size: 1rem;
}

.group-count {
  margin-left: auto;
  color: #6b7280;
  font-size: 0.88rem;
}

.group-kind-meta {
  margin-left: auto;
  color: #247b7d;
  font-size: 0.84rem;
  font-weight: 700;
}

.group-body {
  display: grid;
}

.subgroup {
  border-top: 1px solid rgba(36, 123, 125, 0.08);
}

.subgroup-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border: 0;
  border-top: 1px solid rgba(36, 123, 125, 0.06);
  background: rgba(248, 252, 252, 0.92);
  padding: 0.52rem 0.8rem;
  text-align: left;
}

.subgroup:first-child .subgroup-toggle {
  border-top: 0;
}

.node-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  border: 0;
  border-top: 1px solid rgba(36, 123, 125, 0.08);
  background: white;
  padding: 0.6rem 0.8rem;
  text-align: left;
}

.node-row.clickable:hover {
  background: rgba(240, 253, 250, 0.78);
}

.node-main,
.node-meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.node-label {
  color: #1f2937;
  font-family: var(--default-mono-font, monospace);
  font-size: 0.86rem;
  overflow-wrap: anywhere;
}

.node-type {
  color: #247b7d;
  font-size: 0.84rem;
  font-weight: 700;
  text-align: right;
}

.node-state {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  text-align: right;
}

.node-state.missing {
  color: #b45309;
}

@media (max-width: 900px) {
  .inspector-body {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .node-row {
    flex-direction: column;
  }

  .node-type,
  .node-state {
    text-align: left;
  }
}
</style>
