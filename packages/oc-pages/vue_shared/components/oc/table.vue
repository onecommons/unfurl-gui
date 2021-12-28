<script>
import { GlIcon, GlTable, GlFormInput, GlTooltipDirective } from "@gitlab/ui";
import _ from 'lodash';
import { __ } from '~/locale';

function* expandRows(fields, children, _depth = 0, parent=null) {
  if(fields.length == 0) return;
  const columnName = fields[0].key, remainingColumns = _.tail(fields);
  const grouped = _.groupBy(children, fields[0].groupBy || columnName);
  for (const key in grouped) {
    const group = grouped[key];
    let parentRow = { 
      [columnName]: group[0][columnName],
      tooltips: group[0].tooltips,
      _children: [],
      _childrenByGroup: {},
      _totalChildren: 0,
      _key: columnName,
      _expanded: _depth == 0,
      _depth,
      _controlNodes: _depth == 0? []: [columnName] // top level fields have a separate control
    };
    // add the child rows
    for (const row of expandRows(remainingColumns, group, _depth + 1, parentRow)) {
      parentRow._totalChildren++;
      parentRow._children.push(row);
    }

    let span = 1;
    const childGroups = _.groupBy(parentRow._children, (child) => child._key);
    for(const key in childGroups){
      const childGroup = childGroups[key];
      if(childGroup.length == 1) {
        const child = childGroup[0];
        parentRow  = {...child, ...parentRow};
        if(parentRow._children.length == 1) {
          parentRow._controlNodes = [child._key];
          parentRow._children = child._children;
          delete child._children;
        } else {
          span += 1;
          parentRow._children.splice(parentRow._children.indexOf(child), 1);
        }
      } else {
        parentRow._controlNodes.push(childGroup[0]._key);
      }
    }

    parentRow.childrenOfGroup = function(group) {
      if (parentRow[group]) return 1;
      let result = 0;
      /*
       * caching
      if(!(result = parentRow._childrenByGroup[group])) {
        parentRow._childrenByGroup[group] = result = parentRow._children
          .map(child => child.childrenOfGroup(group))
          .reduce((a,b) => a + b, 0)
      }
       */
      // not caching
      result = parentRow._children
        .map(child => child.childrenOfGroup(group))
        .reduce((a,b) => a + b, 0);
      //

      return result;
    };

    parentRow.childrenToDepth = function*(n) {
      for(const child of parentRow._children) {
        if(!child) break;
        if(n == -1 || child._depth <= n + span) {
          yield child;
        }
        if((_depth + span) != n) {
          for(const descendent of child.childrenToDepth(n)) {
            yield descendent;
          }
        }
        
      }
    };

    parentRow.expose = function() {
      parentRow._expanded = true;
      if(parentRow._parent) parentRow._parent.expose();
    };

    parentRow.setChildrenToDepth = function(n, state) {
      for(const child of parentRow.childrenToDepth(n)) {
        child._expanded = state;
      }
    };

    parentRow.shouldDisplay = function() {
      if(_depth == 0) return true;
      return parentRow._expanded && ((!parentRow._parent) || parentRow._parent.shouldDisplay());
    };

    parentRow.isChild = function() {
      return _depth != 0;
    };


    if(parentRow.isChild()) {
      parentRow._rowVariant = 'expanded';
    } else {
      delete parentRow._rowVariant;
    }

    

    yield parentRow;
    for(const child of parentRow._children) {
      yield child;
    }
    parentRow._children = parentRow._children.filter(row => row._depth - parentRow._depth <= span);
    parentRow._span = span;
    for(const child of parentRow._children){
      child._parent = parentRow;
    }
  }
}

export default {
  name: 'TableComponent',
  props: ['items', 'fields'],
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
      return result;
    },
    _fields() {
      const result = [{key: "selected", label: ""}];
      let i = 0;
      for(const field of this.fields) {
        result.push({index: i++, ...field});
      }
      result.push({ key: "$menu", label: "", });
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
      filter: ''
    };
  },
  watch: {
    filter(val) {
      this.onFilterChange(val);
    }
  },
  methods: {
    // we could use something like this https://www.npmjs.com/package/pluralize
    pluralize(scope) {
      const count = scope.item[scope.field.key]._children.length;
      
      const result = `${count} ${scope.field.label}`;

      if (count == 0) {
        
      } else if (count > 1) {

      } else if (count == 1) {

      }
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
      for(const item of this._items) {
        let matched = false;
        for(const field of this._fields) {
          if(item[field.key] == e) {
            item._filterIndex = field.index;
            matched = true;
            item.expose();
          }
        }
        if(!matched) item._filterIndex = undefined;
      }
    }
  }
};
</script>
<template>
  <div class="container-fluid">
    <div class="row fluid filter-searchbox">
      <div class="col-8"></div>
      <div class="col-4 align-self-end">
        <div class="filter-container">
          <gl-icon name="filter" style="width: 24px; height: 24px; color: #595959"/>
          <span style="padding: 0 5px">Filter: </span>
          <div class="filter-input-container">
            <gl-form-input
              id="filter-input"
              type="search"
              v-model="filter"
              />
              <div style="display: flex; position: absolute; height: 100%; top: 0; right: 4px; align-items: center;">
                <gl-icon name="chevron-down" class="s24" style="color: #4A5053"/>
              </div>
          </div>
        </div>
      </div>
    </div>
    <div class="row-fluid">
      <div class="col-md-12">
        <div v-if="$apollo.loading" class="loading apollo">{{ __("Loading...") }}</div>
        <!--div v-else-if="error" class="error apollo">{{ __("An error occured") }}</div-->

        <div class="oc-table" v-else>
          <!-- Table -->
          <gl-table
            :filter-function="filterFn"
            filter="{}"
            id="accounts-table"
            ref="selectableTable"
            responsive
            tbody-tr-class="oc-table-row"
            layout
            :items="_items"
            :fields="_fields"
            primary-key="id"
            show-empty
          >
          <template #head(selected)>
            <span @click="toggleAll" class="primary-toggle">
                <gl-icon v-if="allExpanded()" title="Collapse All" v-gl-tooltip.hover name="chevron-down" style="margin: 0"/>
                <gl-icon v-else title="Collapse All" v-gl-tooltip.hover name="chevron-right" style="margin: 0"/>
            </span>
          </template>

          <template #head($menu)>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-three-dots-vertical" viewBox="0 0 16 16"> <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/> </svg>
          </template>


          <template #cell(selected)=scope>
            <div class="control-cell left">
              <span @click="_ => toggleExpanded(scope.item.index, 0)" class="table-aside primary-toggle" v-if="scope.item._key == fields[0].key && scope.item._children.length > 1">
                <gl-icon v-if="expandedAt(scope.item.index, 0)" name="chevron-down" />
                <gl-icon v-else name="chevron-right" />
              </span>
            </div>
          </template>

          <template #cell($menu)>
            <div class="control-cell right"></div>
          </template>

          <template #cell()=scope>
            <div class="table-body" :class="{'expanded-row': scope.item.isChild(), 'filter-match': scope.item._filterIndex == scope.field.index}">
              <span class="collapsable" v-if="scope.item._controlNodes.includes(scope.field.key) && scope.item._children.length > 1" @click="_ => toggleExpanded(scope.item.index, scope.field.index)">
                <div v-if="tooltip(scope)" :title="tooltip(scope)" v-gl-tooltip.hover style="position: absolute; bottom: 0; left: 0; height: 100%; width: 100%; z-index: 1"/>
                <gl-icon v-if="expandedAt(scope.item.index, scope.field.index)" name="chevron-down" class="accordion-cell" />
                <gl-icon v-else name="chevron-right" class="accordion-cell" />
                <slot v-if="scope.field.key == scope.item._key" :name="scope.field.key" v-bind="scope"> {{scope.item[scope.field.key]}} </slot>
                <span v-else>{{scope.item.childrenOfGroup(scope.field.key)}} {{scope.field.label}}</span>
              </span>
              <span v-else-if="scope.item[scope.field.key]"> 
                <div v-if="tooltip(scope)" :title="tooltip(scope)" v-gl-tooltip.hover style="position: absolute; bottom: 0; left: 0; height: 100%; width: 100%; z-index: 1"/>
                <slot :name="scope.field.key" v-bind="scope"> {{scope.item[scope.field.key]}} </slot>
              </span>
              <!--
              <span v-else-if="scope.item._totalChildren > 0 && scope.item._childCounts[scope.field.key] > 0">
              -->
              <span v-else-if="false">
                <slot :name="scope.field.key + '$count'">
                <!-- this doesn't actually pluralize yet -->
                {{pluralize(scope)}}
                </slot>
              </span>
              <span v-else>
                <slot :name="scope.field.key + '$empty'"></slot>
              </span>
            </div>
          </template>
          </gl-table>
        </div>
      </div>
    </div>
    <div class="row justify-content-end gl-mt-4">
      <div class="col">
        <!--gl-pagination
          v-model="page"
          :per-page="perPage"
          :total-items="totalRows"
          first-text="First"
          prev-text="Prev"
          next-text="Next"
          last-text="Last"
          aria-controls="accounts-table"
        /-->
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
  padding-bottom: 40px;
}


.oc-table >>> .oc-table-row {
  height: 4.25em;
}

.oc-table >>> table {
  margin-top: -1px;
}

.oc-table >>> th {
  padding: 0.25em 22px;
  /*height: 2.5em;*/
  font-family: 'Open Sans';
  font-weight: bold;
  color: #4A5053;
  background-color: #F4F4F4;
  border-bottom-style: solid;
  border-width: 1px;
  border-color: #DBDBDB;
}

.oc-table >>> td {
  font-family: 'Open Sans';
  white-space: nowrap;
  font-size: 0.8125em;
  border-style: none;
  height: 4.25em;
  padding: 0;
}

.table-body {
  display: flex;
  align-items: end;
  padding: 0.4rem 22px;
  border-style: none;
  border-bottom-style: solid;
  border-width: 1px;
  border-color: #EEEEEE;
  width: 100%;
  height: 100%;
  line-height: 1.2;
}

.table-body >>> * {
  position: relative;
}

.table-body.expanded-row {
  align-items: center;
  padding: 0 22px;
  height: 3rem;
}

.table-body .accordion-cell {
  color:#00D2D9; height: 1.5em; width: 1.5em;
}

.table-body .collapsable {
  display: flex; align-items: center; line-height: 1
}

.table-aside {
  padding: 0.4rem 22px;
}

.table-body.heading {
  font-weight: 700;
  font-family: "Open Sans";
  font-size: 1.07em;
  color: #0099FF;
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
  height: 3rem;
}
.oc-table >>> tr.table-expanded > td {
  height: 3rem;
}


.control-cell {
  border-color: inherit;
  border-width: 1px;
  width: 100%; height: 100%;
}
.control-cell.left { border-right-style: solid; }

.control-cell.right { border-left-style: solid; } 

.oc-table >>> .collapsable {
  margin-left: -0.5em;
}

.collapsable {
  cursor: pointer;
}

.expanded-row  {
  background-color: #F4F4F4;
  border-color: #D1CFD7;
  border-top-style: solid;
}
.table-body.filter-match > span {
  background-color: yellow;
}

.primary-toggle >>> svg {
 box-sizing: content-box; margin-top: 40px; color:#00D2D9; height: 1.875em; width: 1.875em;
 cursor: pointer;
}

</style>
