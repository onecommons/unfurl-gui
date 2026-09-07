<script>
import FileTree from './file-tree.vue'
import { mapGetters, mapActions } from 'vuex'
import { listProjectFiles } from 'oc_vue_shared/client_utils/projects'
import { Button as ElButton, Select as ElSelect, Option as ElOption } from 'element-ui'
import _ from 'lodash'
import * as mime from 'mime-types'
import { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash'
import {blueprintDefaultBranch, homeProjectDefaultBranch} from 'oc_vue_shared/mixins/default-branch'

// ?.input selections are to play nice with a formily workaround
function readExpressionValue(property, index=0) {
    let arr = property
    if(index == 0 && typeof property == 'string') {arr = [property]}
    return arr[index]?.input ?? arr[index]
}


function getMime(fileName) {
    if(fileName?.endsWith('/')) return 'directory'

    const result = mime.lookup(fileName) || null // false to null

    if(result?.match(/(^|\/)x-/)) {
        return 'text/plain'
    }

    return result
}

export default {
    name: 'FileSelector',
    mixins: [blueprintDefaultBranch, homeProjectDefaultBranch],
    components: {
        ElButton, FileTree,
        ElSelect, ElOption,
    },
    props: {
        value: Object,
        schema: Object,
    },
    data() {
        return {
            filesList: [],
            selecting: false,
            selectedNodeId: null,
            fileSelection: null,
            showAllFiles: false,
            chosenLocation: null,
            forbidEnsembleDirectory: false,
        }
    },
    methods: {
        ...mapActions(['createFlash']),
        async fetchFilesList() {
            this.filesList = await listProjectFiles(this.fileRepository)
        },
        treeFromProjectFiles(projectFilesList) {
            const result = {}

            projectFilesList.forEach(projectFile => {
                const [head, ...tail] = projectFile.split('/')

                if(tail.length) {
                    result[head] = _.merge(result[head], this.treeFromProjectFiles([tail.join('/')]))
                } else {
                    if(!this.showAllFiles && this.mimeTypes.length && !this.mimeTypes.includes(getMime(head))) {
                        return
                    }

                    result[head] = null
                }
            })

            // FIXME this is weak enforcement if the root actually only has one file
            if(Object.keys(result).length > 1) {
                return {
                    '': result
                }
            }
            return result
        },

        handleSelect(path) {
            this.selectedNodeId = path
            this.fileSelection = path === null
                ? null
                : path.replace(/\/+/, '/').slice(this.schemaDefaultPrefix.length + 1)
        },

        confirm() {
            this.selecting = false
            this.$emit('change', {
                eval: {
                    abspath: [
                        this.fileSelection,
                        this.location
                    ]
                }
            })
        },

        clear() {
            const value = this.schema.required? null: ''
            this.$emit('change', value)
        },

        parseExpressionFile(expr) {
            let expressionParams
            if(expressionParams = expr?.abspath) {
                return readExpressionValue(expressionParams, 0)
            } else if(expressionParams = expr?.get_dir) {
                return ''
            }
        }

    },
    computed: {
        ...mapGetters(['getHomeProjectPath', 'getCurrentEnvironmentName', 'getCurrentProjectPath', 'getDeploymentTemplate']),
        treeDisplayData() {
            if(!this.selecting) return []

            const entryToNode = (_path, [key, value]) => {
                const root = !key
                const relPath = key || this.schemaDefaultPrefix
                const text = relPath ||  this.fileRepository
                const path = [_path, relPath].join('/')
                const nodes = value === null? null : Object.entries(value).map(entryToNode.bind(null, path))
                const selectable = nodes === null

                const result = {
                    id: path,
                    text,
                    selectable,
                    checkable: selectable || this.directoriesAllowed,
                    expandable: !root && nodes !== null,
                    state: {}
                }

                if(Array.isArray(nodes)) {
                    result.nodes = nodes
                }

                if(!key) {
                    result.state.expanded = true
                }

                return result
            }

            return Object.entries(this.projectFiles).map(entryToNode.bind(null, ''))
        },
        // TODO dry these up
        // most likely for now we always want to use the default for this
        expression() {
            const value = this.value
            return value?.eval || value
        },
        schemaDefaultExpression() {
            const value = this.schema.default
            return value?.eval || value
        },
        expressionFile() {
            return this.parseExpressionFile(this.expression)
        },
        schemaDefaultExpressionFile() {
            return this.parseExpressionFile(this.schemaDefaultExpression)
        },
        mimeTypes() {
            if(this.schema.file_types) return this.schema.file_types.map(getMime)
            if(this.schemaDefaultMimeType) return [this.schemaDefaultMimeType]
            if(!this.expressionFile) return []
            return [getMime(this.expressionFile)]
        },
        schemaDefaultMimeType() {
            if(this.schemaDefaultExpression?.get_dir) return 'directory'
            return getMime(this.schemaDefaultExpressionFile)
        },
        schemaDefaultLocation() {
            let result, expressionParams

            if(expressionParams = this.schemaDefaultExpression?.abspath) {
                result = readExpressionValue(expressionParams, 1)
            } else if (expressionParams = this.schemaDefaultExpression?.get_dir) {
                result = readExpressionValue(expressionParams, 0)
            }

            return result || '.'
        },
        location: {
            get() {
                return this.chosenLocation || this.schemaDefaultLocation
            },
            set(value) {
                this.chosenLocation = value
            }
        },
        schemaDefaultPrefix() {
            if(['spec', 'project'].includes(this.location)) {
                return ''
            } else {
                // default to ensemble dir
                return `environments/${this.getCurrentEnvironmentName}/${this.getCurrentProjectPath}/${this.getDeploymentTemplate.name}`
            }
        },
        directoriesAllowed() {
            return this.mimeTypes.length == 0 || this.mimeTypes.includes('directory')
        },
        displayValue() {
            return `${this.schemaDefaultPrefix}${this.expressionFile}` || '/'
        },
        linkForDisplayValue() {
            return `/${this.fileRepository}/-/blob/${this.defaultEditBranch}/${this.displayValue}`
        },
        linkForViewInRepository() {
            return `/${this.fileRepository}/-/tree/${this.defaultEditBranch}/${this.schemaDefaultPrefix}`
        },
        fileRepository() {
            if(['.', 'project'].includes(this.location)) {
                return this.getHomeProjectPath
            } else if(this.location == 'spec') {
                return this.getCurrentProjectPath
            }
            return null
        },

        filteredFiles() {
            const prefixExpression = new RegExp(`^${this.schemaDefaultPrefix}`)

            const strippedFiles = this.filesList
                .filter(prefixExpression.test.bind(prefixExpression))
                .map(file => file.replace(prefixExpression, ''))

            // we don't want to trim down this list here if it will remove directories that might need to be chosen
            const shouldFilterFilesList = !this.showAllFiles && this.mimeTypes.length && !this.mimeTypes.includes('directory')

            return shouldFilterFilesList? strippedFiles.filter(
                f => {
                    const m = getMime(f)
                    return !m || this.mimeTypes.includes(m)
                }
            ) : strippedFiles
        },

        projectFiles() {
            return this.treeFromProjectFiles(this.filteredFiles)
        },

        defaultEditBranch() {
            // location is always one of the el-select's values: project, . or spec
            return this.location == 'spec'
                ? this.blueprintDefaultBranch
                : this.homeProjectDefaultBranch
        }
    },
    watch: {
        selecting() {
            this.handleSelect(null)
        },

        fileRepository: {
            immediate: true,
            handler(val) {
                if(val) return this.fetchFilesList()
            }
        },

        showAllFiles() {
            return this.fetchFilesList()
        },

        filteredFiles(val) {
            if(val.length == 0 && this.filesList != 0 && this.location == '.') {
                // TODO add a flash for this
                if(this.selecting) {
                    this.createFlash({ message: 'No files were found relative to ensemble - switching to dashboard root.', type: FLASH_TYPES.ALERT})
                }
                this.forbidEnsembleDirectory = true
                this.location = 'project'
            }
        }
    },
}
</script>
<template>
    <div class="file-selector">
        <div class="d-flex flex-column">
            <div v-if="value" style="font-size: 14px;">
                Selected:
                <a :href="linkForDisplayValue" target="_blank">
                    <b class="text-monospace" style="font-size: 12px;">{{displayValue}}</b>
                </a>
                <el-button data-testid="file-selector-clear" @click="clear" icon="el-icon-close" round class="p-1" style="font-size: 12px;"/>
            </div>
            <div v-else-if="!selecting">
                <label style="font-size: 0.85em;" class="mb-4">
                    Relative to:
                    <el-select data-testid="file-selector-location" v-model="location">
                        <el-option label="Dashboard root" value="project" />
                        <el-option v-if="!forbidEnsembleDirectory" label="Deployment directory" value="." />
                        <el-option label="Blueprint repository root" value="spec" />
                    </el-select>
                </label>
                <el-button data-testid="file-selector-choose" @click="selecting=true" class="p-2 w-100">Choose file</el-button>
            </div>
            <div v-if="value || !selecting" class="mb-4"/> <!--spacer-->
        </div>
        <div v-if="selecting && mimeTypes.length > 0" class="mb-0">
            <label> Show all files <input v-model="showAllFiles" type="checkbox"> </label>
        </div>
        <div v-if="selecting">
            <div class="d-flex justify-content-between align-items-center ml-3">
                <a style="font-size: 0.9em;" title="View and make changes to repository files" :href="linkForViewInRepository" target="_blank">View in repository tree</a>
                <el-button data-testid="file-selector-refresh" title="Check for new files" icon="el-icon-refresh" style="padding: 6px; font-size: 1em;" circle @click="fetchFilesList"></el-button>
            </div>
            <file-tree data-testid="file-selector-tree" v-if="treeDisplayData.length > 0" :nodes="treeDisplayData" :selected="selectedNodeId" @select="handleSelect"/>

            <div class="d-flex">
                <el-button data-testid="file-selector-confirm" v-if="fileSelection !== null" @click="confirm" type="primary" class="p-2 w-100">Confirm <b class="text-monospace">{{fileSelection.split('/').pop()}}</b></el-button>
                <el-button data-testid="file-selector-cancel" @click="selecting=false" class="p-2 w-100">Cancel</el-button>
            </div>
        </div>
    </div>
</template>
<style scoped>
.file-selector {
    min-height: 40px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin: 4px 0;
}
</style>
