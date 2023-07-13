<script>
import Tree from 'vuejs-tree'
import { mapGetters } from 'vuex'
import { listProjectFiles } from 'oc_vue_shared/client_utils/projects'
import { Button as ElButton } from 'element-ui'
import _ from 'lodash'
import * as mime from 'mime-types'

// ?.input selections are to play nice with a formily workaround
function readExpressionValue(property, index=0) {
    let arr = property
    if(index == 0 && typeof property == 'string') {arr = [property]}
    return arr[index]?.input ?? arr[index]
}


function getMime(fileName) {
    if(fileName.endsWith('/')) return 'directory'

    const result = mime.lookup(fileName) || null // false to null

    if(result?.match(/(^|\/)x-/)) {
        return 'text/plain'
    }

    return result
}

export default {
    name: 'FileSelector',
    components: {
      ElButton, Tree,
    },
    treeStyles: {
        row: {
            width: '290px',
            child: {
                style: {
                    height: '30px',
                    maxWidth: '100%'
                },
                active: {
                    style: {
                        height: '30px',
                        maxWidth: '100%'
                    }
                }
            }
        },
        tree: {
            overflow: 'hidden',
            maxHeight: 'unset' // asinine default of 500px
        },
        rowIndent: {padding: '0 0 0 10px'},
        selectIcon: {
            class: 'select-icon',
            active: {
                class: 'select-icon'
            }
        }
    },
    props: {
        value: Object,
        schema: Object,
    },
    data() {
        return {
            projectFiles: [],
            treeOptions: {
                events: {
                    checked: {
                        state: true,
                        fn: (...args) => this.handleChecked(...args)
                    }
                }
            },
            selecting: false,
            fileSelection: null,
            showAllFiles: false,
        }
    },
    methods: {
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

        handleSelect(path, val) {
            if(val) {
                this.fileSelection = path.slice(this.schemaDefaultPrefix.length + 2)
            } else {
                this.fileSelection = null
            }
        },

        handleChecked({id, state}) {
            const tree = this.$refs.stupidTree
            const {selected} = state

            const checkboxes = tree.$el.querySelectorAll('input[type="checkbox"]')
            if(!selected) {
                tree.selectNode(id)
                this.handleSelect(id, true)
                checkboxes.forEach(cb => {if(cb.dataset.id != id) cb.checked = false})
            } else {
                tree.deselectAllNodes()
                this.handleSelect(id, false)
                checkboxes.forEach(cb => cb.checked = false)
            }
        },

        confirm() {
            this.selecting = false
            this.$emit('change', {
                eval: {
                    abspath: [
                        this.fileSelection,
                        this.schemaUnfurlPrefix
                    ]
                }
            })
        },

        clear() {
            this.$emit('change', null)
        },

        async fetchAndFilterFiles() {
            this.projectFiles = []
            const filesList = await listProjectFiles(this.fileRepository)

            const prefixExpression = new RegExp(`^${this.schemaDefaultPrefix}`)

            const strippedFiles = filesList
                .filter(prefixExpression.test.bind(prefixExpression))
                .map(file => file.replace(prefixExpression, ''))

            // we don't want to trim down this list here if it will remove directories that might need to be chosen
            const shouldFilterFilesList = !this.showAllFiles && this.mimeTypes.length && !this.mimeTypes.includes('directory')

            const matchingFileTypes = shouldFilterFilesList? strippedFiles.filter(
                f => {
                    const m = getMime(f)
                    return !m || this.mimeTypes.includes(m)
                }
            ) : strippedFiles


            this.projectFiles = this.treeFromProjectFiles(matchingFileTypes)
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
        ...mapGetters(['getHomeProjectPath', 'getCurrentEnvironmentName', 'getCurrentProjectPath']),
        treeDisplayData() {
            // this also serves to clean up vendor tree state
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
                    if(nodes.length == 0) {
                        result.definition = 'empty-folder'
                    }
                }

                if(!key) {
                    result.state.expanded = true
                    result.definition = 'root'
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
            return [getMime(this.expressionFile)]
        },
        schemaDefaultMimeType() {
            if(this.schemaDefaultExpression?.get_dir) return 'directory'
            return getMime(this.schemaDefaultExpressionFile)
        },
        schemaUnfurlPrefix() {
            let result, expressionParams

            if(expressionParams = this.schemaDefaultExpression?.abspath) {
                result = readExpressionValue(expressionParams, 1)
            } else if (expressionParams = this.schemaDefaultExpression?.get_dir) {
                result = readExpressionValue(expressionParams, 0)
            }

            return result || '.'
        },
        schemaDefaultPrefix() {
            if(['spec', 'project'].includes(this.schemaUnfurlPrefix)) {
                return ''
            } else {
                // default to ensemble dir
                return `environments/${this.getCurrentEnvironmentName}`
            }
        },
        directoriesAllowed() {
            return this.mimeTypes.length == 0 || this.mimeTypes.includes('directory')
        },
        displayValue() {
            return `${this.schemaDefaultPrefix}/${this.expressionFile}`
        },
        linkForDisplayValue() {
            return `/${this.fileRepository}/-/blob/main/${this.displayValue}`
        },

        fileRepository() {
            if(['.', 'project'].includes(this.schemaUnfurlPrefix)) {
                return this.getHomeProjectPath
            } else if(this.schemaUnfurlPrefix == 'spec') {
                return this.getCurrentProjectPath
            }
        }
    },
    watch: {
        selecting() {
            this.fileSelection = null
        },

        fileRepository: {
            immediate: true,
            handler(val) {
                if(val) return this.fetchAndFilterFiles()
            }
        },

        showAllFiles() {
            return this.fetchAndFilterFiles()
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
                <el-button @click="clear" icon="el-icon-close" round class="p-1" style="font-size: 12px;"/>
            </div>
            <el-button v-else-if="!selecting" @click="selecting=true" class="p-2 w-100">Choose file</el-button>
            <div v-if="value || !selecting" class="mb-4"/> <!--spacer-->
        </div>
        <div v-if="selecting && mimeTypes.length > 0" class="mb-0">
            <label> Show all files <input v-model="showAllFiles" type="checkbox"> </label>
        </div>
        <div v-if="selecting">
            <tree ref="stupidTree" v-if="treeDisplayData.length > 0" :custom-styles="$options.treeStyles" :custom-options="treeOptions" :nodes="treeDisplayData"/>

            <div class="d-flex">
                <el-button v-if="fileSelection !== null" @click="confirm" type="primary" class="p-2 w-100">Confirm <b class="text-monospace">{{fileSelection.split('/').pop()}}</b></el-button>
                <el-button @click="selecting=false" class="p-2 w-100">Cancel</el-button>
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

.file-selector >>> ul {
    padding-left: 0;
    display: block;
}

.file-selector >>> li {
    max-width: 100%;
    display: flex;
    flex-wrap: wrap;
    overflow-x: visible;
}

.file-selector >>> .row_data {
    position: relative;
    display: inline-block;
    padding-left: 16px;
    padding-right: 16px;
    overflow: hidden;
}

.file-selector >>> .row_data > input[type="checkbox"] {
    position: absolute;
    right: calc(-50% + 7px);
    top: 10px;
    padding: 0 50%;
    width: 100%;
}

.file-selector >>> .row_data > input[type="checkbox"]:before {
    content: "";
    width: 100%;
    height: 30px;
    display: block;
    position: relative;
    z-index: 10;
    top: -7.5px;
    left: -50%;
}

.file-selector >>> .row_data > input[type="checkbox"]:nth-child(3):before {
    z-index: 12;
}

.file-selector >>> .row_data > :last-child {
    user-select: none;
    margin-left: 16px;
    pointer-events: none;
    max-width: calc(100% - 25px);

}

.file-selector >>> .row_data > span[title="root"] {
    margin-left: 0;
    display: inline-block;
    max-width: 100%;
}

.file-selector >>> .row_data > span[title="empty-folder"] {
    margin-left: 0;
    display: inline-block;
    max-width: 100%;
    height: 30px;
}

.file-selector >>> .row_data > span[title="empty-folder"]:before {
    margin-left: 0;
    margin-right: -1px;
    content: '\1F5C0';
    font-size: 16px;
    height: 100%;
    height: 30px;
    display: inline-block;
    vertical-align: middle;

}

.file-selector >>> .row_data > span:nth-child(4) {
    max-width: calc(100% - 7px);
}

.file-selector >>> .row_data > i {
    margin-right: -18px;
    margin-top: 1px;
}

.file-selector >>> .capitalize {
    text-transform: none;

    /* copied from .text-monospace */
    font-family: "Menlo", "DejaVu Sans Mono", "Liberation Mono", "Consolas", "Ubuntu Mono", "Courier New", "andale mono", "lucida console", monospace !important;
    font-size: 14px;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
}

.file-selector >>> .expanded_icon {
    margin-left: -12px;
    margin-right: 7px;
}

.file-selector >>> .row_data > span:first-child {
    display: inline-block;
    width: 100%;
    margin-right: -100%;
    z-index: 11;
    position: relative;
}

.file-selector >>> .row_data i.expanded_icon:after {
    font-style: normal;
    content: '\1F5C0';
    position: absolute;
    left: 5px;
    top: -17px;
    transition: all .2s ease;
}

.file-selector >>> .row_data i.expanded.expanded_icon:after  {
    content: '\1F5C1';
    left: -12px;
    top: -35px;
    transform: rotate(270deg);
}

.file-selector >>> ul {
    margin-bottom: 0;
}

.file-selector >>> .select-icon:before {
    content: "\1F5CE";
    font-style: normal;
    height: 30px;
    display: inline-block;
    vertical-align: middle;
}

</style>
<sytle
