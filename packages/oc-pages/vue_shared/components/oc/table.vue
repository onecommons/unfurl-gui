<script>
import { GlIcon, GlTable, GlFormInput, GlTooltipDirective } from "@gitlab/ui";
import _ from 'lodash';
import { __, n__ } from '~/locale';

function searchMatchingFunction(cellContent, searchKey) {
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
      this._expanded = true;
      if(this._parent) this._parent.expose();
    };

    parentRow.setChildrenToDepth = function(n, state) {
      for(const child of this.childrenToDepth(n)) {
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
    noMargin: { type: Boolean, default: false }
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
      if(!scope.field.s) return ''
      const count = scope.item.childrenOfGroup(scope.field.key) || 0
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
  }
};
</script>
<template>
  <div :class="{'container-fluid': !noMargin,  'mt-4': !noMargin, 'no-margin': noMargin}">
    <div v-if="!hideFilter" class="row fluid no-gutters filter-searchbox" >
      <div class="col-lg-8 col-md-7 col-sm-2 "></div>
      <div class="col-lg-4 col-md-5 col-sm-10 align-self-end">
        <div class="filter-container">
          <svg fill="none" height="20" width="20" viewBox="0 0 16 16"  xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><clipPath id="a"><path d="m0 0h16v16h-16z"/></clipPath><g clip-path="url(#a)"><path d="m15.4356.259637c-.1783-.133197-.3887-.1853172-.5907-.259637h-13.6944c-.01668.0376425-.05324.0273471-.08275.0321731-.301831.0663116-.57219.2336739-.76663.4745729-.19444.240898-.30138873.540994-.30326321.850954-.00352784.41536.16580821.75253.45733521 1.0392 1.564438 1.5383 3.128868 3.07671 4.693298 4.61522.04079.03642.07305.08144.09445.13184.0214.05039.03142.10491.02934.15965-.00363 2.40655-.00481 4.81299-.00352 7.21929 0 .232.02052.4582.11802.6725.33226.7322 1.16579 1.0115 1.91626.6376.8393-.4182 1.67283-.8484 2.5163-1.2579.62376-.3031.91466-.7796.90986-1.48-.0135-1.9304-.0035-3.86078-.0074-5.79117-.0026-.05483.0072-.10955.0287-.16004.0215-.05048.0541-.09543.0954-.13144.2941-.27959.5808-.56689.8698-.8513 1.2797-1.25733 2.5583-2.51551 3.836-3.77455.6428-.6351.5853-1.603829-.1161-2.126963zm-.939 1.248633c-1.6696 1.64469-3.3403 3.28831-5.01209 4.93085-.04038.03696-.07209.08245-.09283.13319s-.03.10547-.02711.16023c.00289 2.11763 0 4.23526.00513 6.35286 0 .1355-.0356.2079-.16035.2696-.80724.3974-1.60998.8044-2.41433 1.2075-.04618.0232-.09621.0415-.14432.0627-.03207-.0714-.01795-.1357-.01795-.1978 0-2.5612.00074-5.12273.00224-7.68456.00241-.05997-.00851-.11972-.03198-.17492-.02346-.0552-.05888-.10447-.10368-.14424-1.67326-1.64212-3.34481-3.28595-5.01465-4.93149-.02919-.02864-.05613-.05952-.10616-.11293h13.21078c-.0042.06853-.0574.09298-.0927.12901z" fill="#595959"/></g></svg>
          <span style="padding: 0 5px">Filter: </span>
          <div class="filter-input-container">
            <gl-form-input
              id="filter-input"
              debounce="500"
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
            tbody-tr-class="oc-table-row"
            responsive="lg"
            :items="_items"
            :fields="_fields"
            primary-key="id"
            show-empty
          >
          <template #head(selected)>
            <span @click="toggleAll" class="control-cell primary-toggle">
                <gl-icon v-if="allExpanded()" title="Collapse All" v-gl-tooltip.hover name="chevron-down" style="margin: 0"/>
                <gl-icon v-else title="Expand All" v-gl-tooltip.hover name="chevron-right" style="margin: 0"/>
            </span>
          </template>

          <!--template #head($menu)>
            <span class="control-cell">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-three-dots-vertical" viewBox="0 0 16 16"> <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/> </svg>
            </span>
          </template-->

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
                <span class="collapsable" v-if="scope.item._controlNodes.includes(scope.field.key) && scope.item._children.length > 1" @click="_ => toggleExpanded(scope.item.index, scope.field.index)">
                  <div v-if="tooltip(scope)" :title="tooltip(scope)" v-gl-tooltip.hover style="position: absolute; bottom: 0; left: 0; height: 100%; width: 100%; z-index: 1"/>
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
  font-size: 1em;
}


.oc-table >>> .oc-table-row {
  height: 4.25em;
}

.oc-table >>> table {
  margin-top: -1px;
  border-bottom-style: solid;
  border-bottom-color: white;
  border-bottom-width: 40px; /*fix scrollbar position*/
}

.oc-table >>> th {
  padding: 0.25em 0;
  font-family: 'Open Sans';
  font-size: 0.95em;
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
  padding: 0.4rem 0;
  border-style: none;
  border-bottom-style: solid;
  border-width: 1px;
  border-color: #EEEEEE;
  width: 100%;
  height: 100%;
  line-height: 1.35;
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
  height: 3em;
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
thead * {
    line-height: 0!important
}
</style>
