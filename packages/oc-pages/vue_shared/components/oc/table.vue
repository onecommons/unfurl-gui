<script>
import { GlIcon, GlTable, GlFormInput, GlTooltipDirective } from "@gitlab/ui";
import _ from 'lodash';
import { __, n__ } from '~/locale';

function searchMatchingFunction(_cellContent, searchKey) {
  const cellContent = typeof _cellContent == 'object'? JSON.stringify(_cellContent): _cellContent?.toString()
  if(!(cellContent && cellContent.toLowerCase)) return false;
  if(searchKey.length <= 2) {
    return cellContent.toLowerCase() == searchKey.toLowerCase();
  } else {
    return cellContent.toLowerCase().includes(searchKey.toLowerCase());
  }
}

function* expandRows(fields, children, _depth = 0, parent=null) {
  if(fields.length == 0) return;
  const field = fields[0]
  const columnName = field.key, remainingColumns = _.tail(fields);
  const grouped = _.groupBy(children, field.groupBy || field.textValue || columnName);
  for (const key in grouped) {

    const group = grouped[key];
    const columnTarget = field.textValue?
    field.textValue(group[0]) :
      group[0][columnName]

      let parentRow = { 
        [columnName]: columnTarget,
        tooltips: group[0].tooltips,
        context: group[0].context,
        _shallow: field.shallow,
        _children: [],
        _childrenByGroup: {},
        _totalChildren: 0,
        _key: columnName,
        _expanded: _depth == 0,
        _depth,
        _controlNodes: []
      };
      // add the child rows
      let span = 1;

      while(remainingColumns[0]?.shallow) {
        const field = remainingColumns[0]
        const columnName = field.key
        parentRow[columnName] = field.textValue?
        field.textValue(group[0]) :
          group[0][columnName]

          span++
            remainingColumns.shift()
      }
      for (const row of expandRows(remainingColumns, group, _depth + 1, parentRow)) {
        if(! row._parent) {
          parentRow._totalChildren++;
          parentRow._children.push(row);
        }
      }

      const childGroups = _.groupBy(parentRow._children, (child) => child._key);
      for(const key in childGroups){
        const childGroup = childGroups[key];
        if(childGroup.length == 1) {
          const child = childGroup[0];
          Object.assign(parentRow, {...child, ...parentRow});
          if(parentRow._children.length == 1) {
            parentRow._children = child._children;
            if(parentRow._children.length && ! parentRow._children[0]._shallow) {
              parentRow._controlNodes = [parentRow._children[0]._key];
            }
            delete child._children;
          } else {
            span += 1;
            parentRow._children.splice(parentRow._children.indexOf(child), 1);
          }
        } else {
          parentRow._controlNodes.push(childGroup[0]._key);
          span +=1;
        }
      }

      parentRow.childrenOfGroup = function(group) {
        let result = 0;
        result = this._children
          .map(child => child.childrenOfGroup(group))
          .reduce((a,b) => a + b, 0);
          if (this[group]) result ++;

          return result;
      };

      parentRow.childrenToDepth = function*(n) {
        for(const child of this._children) {
          if(!child) break;
          if(n == -1 || child._depth <= n) {
            yield child;
          }
          if(n == -1 || (this._depth + this._span) <= n) {
            for(const descendent of child.childrenToDepth(n)) {
              yield descendent;
            }
          }

        }
      };

      parentRow.expose = function() {
        this._expanded = true;
        if(this._parent) this._parent.expose();
      };

      parentRow.setChildrenToDepth = function(n, state) {
        for(const child of this.childrenToDepth(n)) {
          child._expanded = state;
        }
      };

      parentRow.shouldDisplay = function() {
        if(this._depth == 0) return true;
        return parentRow._expanded && ((!parentRow._parent) || parentRow._parent.shouldDisplay());
      };

      parentRow.isChild = function() {
        return this._depth != 0;
      };


      if(parentRow.isChild()) {
        parentRow._rowVariant = 'expanded';
      } else {
        delete parentRow._rowVariant;
      }



      parentRow._span = span;
      for(const child of parentRow._children){
        child._parent = parentRow;
      }

      yield parentRow
      for(const child of parentRow.childrenToDepth(-1)) yield child
  }
}

export default {
  name: 'TableComponent',
  props: {
    items: Array,
    fields: Array,
    useCollapseAll: {
      type: Boolean,
      default: true
    },
    hideFilter: { type: Boolean, default: false },
    noMargin: { type: Boolean, default: false },
    rowClass: [Object, Function],
    startExpanded: Boolean
  },
  directives: {
    GlTooltip: GlTooltipDirective,
  },
  components: {
    GlTable,
    GlIcon,
    //GlPagination,
    //GlFormCheckbox,
    GlFormInput
  },

  computed: {
    _items() {
      const result = [];
      let i = 0;
      for(const row of expandRows(this.fields, this.items)) {
        row.index = i++;
        result.push(row);
      }
      window.items = result
      return result;
    },
    _fields() {
      const result = this.useCollapseAll? [{key: "selected", label: "", thStyle: {width: '0px'}}] : [];
      let i = 0;
      for(const field of this.fields) {
        const label = field.label.trim()
        result.push({index: i++, ...field, label});
      }
      // balance table gutters
      if(this.useCollapseAll) result.push({ key: "$menu", label: "", thStyle: {width: '0px'}});
      return result;
    },
    keys() {
      const result = {};
      for(const field of this._fields) {
        if(field.index !== undefined) {
          result[field.key] = field.index;
        }
      } 
      return result;
    },

  },
  data() {
    return {
      filter: '',
      matchedResults: false,
      showingToast: false
    };
  },
  watch: {
    filter(val) {
      this.matchedResults = this.onFilterChange(val);
      this.debouncedSearch();
    }
  },
  methods: {
    pluralize(scope) {
      const count = scope.item.childrenOfGroup(scope.field.key) || 0
      if(scope.field.pluralize) {
        const result = scope.field.pluralize(count, scope.item)
        if(typeof result == 'string') {
          return result
        }
      }
      if(!scope.field.s) return ''
      const result = `${count} ${n__(scope.field.s, scope.field.label, count)}`;
      return result;
    },
    filterFn(row, filterState) {
      const result = row.shouldDisplay();
      return result;
    },
    toggleExpanded(row, depth) {
      const item = this._items[row];
      item.setChildrenToDepth(depth, !this.expandedAt(row, depth));
      if(this.filter) {
        this.onFilterChange(this.filter);
      }
    },
    toggleAll() {
      const allExpanded = this.allExpanded();
      for(const item of this._items) {
        if(item._depth == 0) {
          item.setChildrenToDepth(-1, !allExpanded);
        }
      }
    },
    expandedAt(row, depth) {
      const item = this._items[row];
      for(const child of item.childrenToDepth(depth)) {
        if(!child._expanded) {
          return false;
        }
      }
      return true;
    },
    allExpanded() {
      for(const row of this._items) {
        if(row._depth == 0 && !this.expandedAt(row.index, -1))
        return false;
      }
      return true;

    },
    tooltip(scope) {
      const {item, field} = scope;
      const result= item.tooltips && item.tooltips[field.key];
      return result;
    },
    onFilterChange(e){
      let result = false;
      for(const item of this._items) {
        let matched = false;
        for(const field of this._fields) {
          if(searchMatchingFunction(item[field.key], e)){
            item._filterIndex = field.index;
            matched = result = true;
            item.expose();
          }
        }
        if(!matched) item._filterIndex = undefined;
      }
      return result;
    },
    debouncedSearch: _.debounce(function() {
      if(this.filter.length >= 3 && !this.matchedResults && !this.showingToast) {
        this.showingToast = true;
        const instance = this;
        this.$toast.show('No results found', {
          onComplete(){ instance.showingToast = false; }
        });
      }
    }, 1000)
  },

  created() {
    if(this.startExpanded) {
      this.toggleAll()
    }
  }
};
</script>
<template>
  <div class="p-0" :class="{'container-fluid': !noMargin,  'mt-4': !noMargin, 'no-margin': noMargin}">
    <div v-if="!hideFilter && _items.length > 1" class="row fluid no-gutters filter-searchbox" >
      <div class="col-lg-8 col-md-7 col-sm-2 "></div>
      <div class="col-lg-4 col-md-5 col-sm-10 align-self-end">
        <div class="filter-container">
          <div class="filter-input-container">
            <gl-form-input
              id="filter-input"
              debounce="500"
              type="search"
              placeholder="Search"
              v-model="filter"
            />
            <div style="display: flex; position: absolute; height: 100%; top: 0; right: 4px; align-items: center;">
              <gl-icon name="search" class="s24" style="color: #4A5053AA"/>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="row-fluid no-gutters">
      <div class="col-md-12">
        <div v-if="$apollo.loading" class="loading apollo">{{ __("Loading...") }}</div>
        <!--div v-else-if="error" class="error apollo">{{ __("An error occured") }}</div-->

      <div class="oc-table" :class="{'secondary-is-primary': !useCollapseAll}" v-else>
        <!-- Table -->
        <gl-table
          :filter-function="filterFn"
          filter="{}"
          id="accounts-table"
          ref="selectableTable"
          :tbody-tr-class="rowClass"
          :responsive="true"
          :items="_items"
          :fields="_fields"
          primary-key="id"
          :thead-class="{'no-collapse-all': !useCollapseAll}"
          show-empty
        >

          <template #emptyfiltered>
            <slot name="empty" />
          </template>
          <template #head(selected)>
            <slot name="selected$head">
                <span @click="toggleAll" class="control-cell primary-toggle">
                  <gl-icon v-if="allExpanded()" title="Collapse All" v-gl-tooltip.hover name="chevron-down" style="margin: 0"/>
                  <gl-icon v-else title="Expand All" v-gl-tooltip.hover name="chevron-right" style="margin: 0"/>
                </span>
            </slot>
          </template>


        <template #head()=scope>
          <slot :name="scope.field.key + '$head'" v-bind="scope">
            {{scope.field.label}}
          </slot>
        </template>


        <template #cell(selected)>
          <div class="control-cell left" />
        </template>

        <template #cell($menu)>
          <div class="control-cell right" />
        </template>

        <template #cell()=scope>
          <div class="table-body" :style="scope.field.tableBodyStyles" :class="{'expanded-row': scope.item.isChild(), 'filter-match': scope.item._filterIndex == scope.field.index}">
            <slot :name="scope.field.key + '$all'" v-bind="scope">
              <span class="collapsable" v-if="scope.item.childrenOfGroup(scope.field.key) > 1" @click="_ => toggleExpanded(scope.item.index, scope.field.index)">
                <div v-if="tooltip(scope)" :title="tooltip(scope)" v-gl-tooltip.hover style="position: absolute; bottom: 0; left: 0; height: 100%; width: 100%; z-index: 1" />
                <span v-if="scope.field.index != 0">
                  <gl-icon v-if="expandedAt(scope.item.index, scope.field.index)" name="chevron-down" class="accordion-cell" />
                  <gl-icon v-else name="chevron-right" class="accordion-cell" />
                </span>
                <span v-else style="margin-left: 0.5em;" />
                <slot v-if="scope.field.key == scope.item._key" :name="scope.field.key" v-bind="scope"> {{scope.item[scope.field.key]}} </slot>
                <!--span v-else>{{scope.item.childrenOfGroup(scope.field.key)}} {{scope.field.label}}</span-->
              <span v-else>{{pluralize(scope)}}</span>
            </span>
            <span v-else-if="scope.item[scope.field.key]" :class="{'indent-to-widget': scope.field.index > 0 && scope.item._depth == scope.field.index}"> 
              <div v-if="tooltip(scope)" :title="tooltip(scope)" v-gl-tooltip.hover style="position: absolute; bottom: 0; left: 0; height: 100%; width: 100%; z-index: 1"/>
              <slot :name="scope.field.key" v-bind="scope"> {{scope.item[scope.field.key]}} </slot>
            </span>
            <span v-else>
              <slot :name="scope.field.key + '$empty'" v-bind="scope">
                <span v-if="scope.item._depth + scope.item._span <= scope.field.index">
                  {{pluralize(scope)}}
                </span>
              </slot>
            </span>
          </slot>
        </div>
      </template>
    </gl-table>
  </div>
</div>
    </div>
  </div>
</template>
<style scoped>


.oc-table {
  border-color: #DBDBDB;
  border-style: solid;
  border-radius: 4px;
  border-width: 1px;
  font-size: 1.15em;
}


.oc-table >>> .table-responsive {
  margin-bottom: 0;
}

.oc-table >>> tbody tr {
  height: 4.25em;
}

.oc-table >>> table {
  margin-top: -1px;
  border-bottom-style: solid;
  border-bottom-color: white;
}

.oc-table >>> tr:last-child .table-body {
  border-bottom-style: none;
}

.oc-table >>> table tr th {
  padding: 0.25em;
  white-space: nowrap;
  font-family: 'Noto Sans';
  font-size: 0.95em;
  font-weight: bold;
  color: #4A5053;
  border-bottom-style: solid;
  border-width: 1px;
  border-color: #DBDBDB;
  vertical-align: middle;
}

.oc-table >>> table tr td {
  font-family: 'Noto Sans';
  white-space: nowrap;
  font-size: 0.8125em;
  border-style: none;
  height: 4.25em;
  padding: 0;
}

.table-body {
  display: flex;
  align-items: center;
  padding: 0.4rem 0.25em;
  border-style: none;
  border-bottom-style: solid;
  border-width: 1px;
  border-color: #EEEEEE;
  width: 100%;
  height: 100%;
}


.table-body >>> * {
  position: relative;
}

.table-body > span {
  width: 100%;
}

.table-body.expanded-row {
  align-items: center;
  padding: 0px;
  height: 3rem;
}

.table-body .accordion-cell {
  color:#00D2D9; height: 1.5em; width: 1.5em;
}

.expanded-row .accordion-cell {
  color: #4A5053;
}

.table-body .collapsable {
  display: flex; align-items: center;
}

.filter-container {
  display: flex; align-items: center; justify-content: right;
  padding-right: 1em;
  color: #4A5053;
  font-family: "Open Sans";
  font-weight: 300;
  margin-bottom: 2em;
}

.filter-container >>> input {
  background-color: #EEEEEE;
  outline: none;
  border-style: none;
  box-shadow: none;
}

.filter-input-container {
  border-radius: 4px;
  max-width: 200px;
  position: relative;
}

.oc-table >>> tr {
  box-sizing: border-box;
  border-color: white;
}
.oc-table >>> td {
  border-color: inherit;
  box-sizing: border-box;
}

.oc-table >>> tr.table-expanded {
  border-color: #D1CFD7;
  height: 0;
}
.oc-table >>> tr.table-expanded > td {
  height: 3em;
}


.control-cell {
  border-color: inherit;
  border-width: 1px;
  width: 100%; height: 100%;
}

th .control-cell {
  margin: 0 1em;
}
.control-cell.left { border-right-style: solid; }

.control-cell.right { border-left-style: solid; } 

.oc-table >>> .collapsable {
  margin-left: -0.5em;
}

.oc-table.second-is-primary >>> td:nth-child(2) {
  color: #0099FF;
  font-weight: bold;
  font-size: 0.88em;
}

.collapsable { cursor: pointer; }
.collapsable >>> span {display: flex;}

.expanded-row  {
  background-color: #F4F4F4;
  border-color: #D1CFD7;
  border-top-style: solid;
}
.table-body.filter-match > span {
  background-color: yellow;
}

.table-body > * {
  margin-right: 1em;
}

.primary-toggle >>> svg {
  box-sizing: content-box; color:#00D2D9; height: 1.875em; width: 1.875em;
  cursor: pointer;
}

.indent-to-widget {
  margin-left: 1.25em;
}

.no-margin { margin: -1px; }
.no-margin >>> table { border-bottom-width: 0; }
.no-margin >>> .gl-table { margin-bottom: -1px; }

</style>

<style>
.oc-table thead * { line-height: 0!important }
.oc-table thead.no-collapse-all * { line-height: 2!important }
</style>
