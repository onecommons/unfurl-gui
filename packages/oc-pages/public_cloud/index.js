import * as d3 from 'd3'
import ElementUI from 'element-ui'
import AwsIcon from 'oc_vue_shared/components/oc/icons/aws.svg'
import AzureIcon from 'oc_vue_shared/components/oc/icons/azure.svg'
import DigitalOceanIcon from 'oc_vue_shared/components/oc/icons/digital_ocean.svg'
import K8sIcon from 'oc_vue_shared/components/oc/icons/k8s.svg'
import GcpIcon from 'oc_vue_shared/components/oc/icons/gcp.svg'
import Vue from 'vue'
import {setupTheme} from 'oc_vue_shared/theme'
import _ from 'lodash'
import Tooltip from './tooltip.vue'
import Navbar from './navbar.vue'
import CloudTable from './cloud-table.vue'
import CloudGraphInspector from './cloud-graph-inspector.vue'
import cloudGraphData from './cloud-graph-inspector-mock.data.json'
import MapControls from './map-controls.vue'
import {lookupCloudProviderAlias} from 'oc_vue_shared/util'

import getFormattedData from './formatted-data'
import getData from './raw-data'
import './public-cloud.css'

Vue.use(ElementUI)
setupTheme(Vue)

// Assigned when the page is initialized, not at import time: the standalone build
// has no welcome banner and the DOM isn't guaranteed to exist when this module loads.
let glDark = false
let welcomeBanner = null


function isFocusable(node) {
  if(!node) return false
  const {data} = node
  return data.kind != 'type'
}

function cloudIcon({data}) {
  if(data.kind == 'cloud') {
    return ProviderIcons[data.name]
  }
}

function cloudIconFilter({data}) {
  if(!glDark) return null
  return data.name != lookupCloudProviderAlias('gcp') ? 'invert(1) hue-rotate(180deg)': null
}

function labelSize(node) {
  const base = BASE_FONT / 4
  // slowly (pow 1/3) scales up with radius
  // barely (pow 1/10) scales down with text length
  const labelText = toLabel(node)
  const size = base * Math.pow(node.r, 1/3) / Math.pow(labelText?.length || 1, 1/10)
  return Math.min(
    size,
    MAX_FONT_SIZE
  ) + 'px'

}

function toLabel({data}) {
  if(data.icon) return false
  switch(data.kind) {
    case 'type':
      return data.title
    case 'category':
      return categoryTitles[data.name]
    case 'cloud':
      return data.name == 'unassociated' && 'Self-Hosted'
  }
}

const LABEL_POSITIONS = [
  [0, 0],
  [0, 2/3],
  [0, 1/2],
  [0, -5/6],
  [0, 1],
  [-1/3, 2/3],
]


const BASE_FONT = 20
const MAX_FONT_SIZE = 28
const MINIMUM_SCALE = 1

let tooltip, navbar
let focus, zoom
let zoomIn, zoomOut
let focusI = -1
let tooltipFocus, tooltipCursorX, tooltipCursorY
let cursorX, cursorY, inBounds
let bounds = {}
let setFocus = () => {}
let root

const pack = (data, width, height) => d3.pack()
  .size([width, height])
  .padding(20)
(d3.hierarchy(data)
  .sum(d => d.value)
  .sort((a, b) => b.value - a.value))


function opacity({depth}) {
  return (
    depth == 1? 0.15:
    depth == 2? 0.25:
    depth == 3? 0.50:
    depth == 4? 0.75: 0
  )
}

function color({data, depth}) {
  const defaultColor = glDark? 'white': 'gray'
  switch(data.kind) {
    case 'cloud':
      switch(lookupCloudProviderAlias(data.name)) {
        case lookupCloudProviderAlias('azure'):
          return '#34B6EB'
        case lookupCloudProviderAlias('aws'):
          return '#FE9A01'
        case lookupCloudProviderAlias('gcp'):
          return `rgb(222,82,70)`
        case lookupCloudProviderAlias('k8s'):
          return '#326CE4'
        case lookupCloudProviderAlias('DigitalOcean'):
          return '#0180FE'
        default:
          return defaultColor
      }
    default:
      return defaultColor
  }
}

const chart = (appendTo, data, width, height, reserveTop) => {
  focus = root = pack(data, width, height - reserveTop / 2)

  let hoveredNode, mouseDownOnNode
  let prevTransform, transform
  prevTransform = transform = d3.zoomIdentity

  setFocus = function(_event, d) {
    if(d && !isFocusable(d)) return
    if(d && (focus == d) && d.parent) {
      focus = d.parent
    } else if(d){
      focus = d
    } else {
      focus = root
    }


    // set bounds doesn't seem to apply unless we use the minimum scale here
    const zoomLevel = Math.max(MINIMUM_SCALE, Math.min(width / focus.r, height / focus.r) / 2.5)
    const nodeX = width - focus.x
    const nodeY = height - focus.y
    const left = width * 0.5 - zoomLevel * nodeX
    const top = height * 0.5 - zoomLevel * nodeY
    svg.transition().duration(750).call(
      zoom.transform,
      d3.zoomIdentity.translate(left, top).scale(zoomLevel)
    )
  }


  function labelPos(node) {
    const defaultPos = LABEL_POSITIONS[1]
    const [x, y] = LABEL_POSITIONS[node.children?.length] || defaultPos

    return [
      width - node.x - node.r * x,
      height - node.y - node.r * y
    ]
  }

  function labelX(node) {
    return labelPos(node)[0]
  }

  function labelY(node) {
    return labelPos(node)[1]
  }

  function cloudIconX(node) {
    return labelX(node) - BASE_FONT
  }

  function cloudIconY(node) {
    return labelY(node) - BASE_FONT
  }

  function circleWidthAtPos(node) {
    const defaultPos = LABEL_POSITIONS[1]
    const [x, y] = LABEL_POSITIONS[node.children?.length] || defaultPos
    return Math.sqrt(Math.pow(node.r, 2) - Math.pow(Math.abs(y) * node.r, 2)) * 2 - (Math.abs(x) * node.r)
  }

  function textWidthForPos(node) {
    const defaultPos = LABEL_POSITIONS[1]
    const [x, y] = LABEL_POSITIONS[node.children?.length] || defaultPos
    const widthAtPos = circleWidthAtPos(node) * 0.9 // ~10% padding
    const labelText = toLabel(node)
    const fontSize = parseFloat(labelSize(node).slice(0, -2))

    if(labelText.length  / 2 * fontSize > widthAtPos) { // guess whether we're over width
      // set textLength to appx. width of the circle
      return widthAtPos || null // Do not return 0 for firefox
    }
    // do not modify text width (i.e. do not stretch)
    return null
  }

  function onMouseMove(event, d) {
    tooltipCursorX = event.clientX
    tooltipCursorY = event.clientY
  }

  function onMouseDown(event, d) {
  }

  function appIconHref({data}) {
    const url = data._sourceinfo.url
    if(url.includes('onecommons/unfurl-types')) return
    return url
  }

  function onClickAppIcon(event, {data}) {
    event.stopPropagation()
  }

  function fastUpdateTooltip({item, expectedNode}) {
    if(expectedNode && hoveredNode != expectedNode) return
    if(tooltip.isMousedOver) return
    if(item) tooltipFocus = item
    tooltip.$props.item = tooltipFocus
    tooltip.$props.left = tooltipCursorX + 10
    tooltip.$props.top = tooltipCursorY + 10
  }

  const updateTooltip = _.debounce(fastUpdateTooltip, 500)
  const slowUpdateTooltip = _.debounce(fastUpdateTooltip, 750)

  const svg = d3.create("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("display", "block")
    .style("cursor", "pointer")
    .on('mousemove', function(e) {
      cursorX = e.clientX
      cursorY = e.clientY

      inBounds = (
        cursorX >= bounds.x1 && cursorX <= bounds.x2 &&
        cursorY >= bounds.y1 && cursorY <= bounds.y2
      )

      if(!inBounds) {
        document.querySelector('div#chart svg').style.cursor = 'default'
      } else {
        document.querySelector('div#chart svg').style.cursor = 'grab'
      }
    })

  const node = svg.append("g")
    .selectAll("circle")
    .data(root.descendants().slice(1).filter(d => d.depth < 5))
    .join("circle")
      .attr('class', d => `${d.data.kind} depth-${d.depth}`)
      .attr("fill", color)
      .attr("opacity", d => opacity(d))
      .attr("cx", d => width - d.x)
      .attr("cy", d => height - d.y)
      .attr("r", d => d.r)
      .attr("stroke-width", d => `${1 + d.r / 25}px`)
      .on("mousemove", onMouseMove)
      .on("mouseover", function(event, d) {
        hoveredNode = this
        tooltipCursorX = event.clientX
        tooltipCursorY = event.clientY
        updateTooltip({item: d, expectedNode: this})
        d3.select(this).attr("stroke", "#FFF")
      })
      .on("mouseout", function(event, d) {
        tooltipCursorX = -1000
        tooltipCursorY = -1000
        updateTooltip({item: null})
        d3.select(this).attr("stroke", null);
      })
      .on("mousedown", onMouseDown)
      .on("click", setFocus)


  const connections = svg.append("g")
    .selectAll("path")
    .data(root.descendants().filter(d => d.data.connection))
    .join('path')
      .attr('stroke', '#00d2d9')
      .attr('stroke-width', '0.5')
      .attr('fill', 'none')
      .attr('opacity', '0.8')
      .attr('d', d => {
        const
          beginX = d.x, beginY = d.y

        let connectedNode
        if(!(connectedNode = root.descendants().find(target => d.data.connection == target.data.id))) {
          return
        }

        const endX = connectedNode.x, endY = connectedNode.y

        const
          dx = endX - beginX, dy = endY - beginY

        return `M 0 0 l ${dx} ${dy}`
      })


  const appIcon = svg.append('g')
    .selectAll('foreignObject')
    .data(root.descendants().filter(d => d.data.kind == 'type'))
    .join('foreignObject')
      .attr('width', d => d.r * 2)
      .attr('height', d => d.r * 2)
      .attr('x', d => width - d.x - d.r)
      .attr('y', d => height - d.y - d.r)
      .attr('display', 'flex')
      .style('transition', 'opacity 1s')
      .on("mousemove", onMouseMove)
      .on("mouseover", function(event, d) {
        hoveredNode = this
        tooltipCursorX = event.clientX
        tooltipCursorY = event.clientY
        updateTooltip({item: d, expectedNode: this})
        d3.select(this).attr("stroke", "#FFF")
      })
      .on("mouseout", function(event, d) {
        tooltipCursorX = -1000
        tooltipCursorY = -1000
        tooltipFocus = null
        updateTooltip({})
        d3.select(this).attr("stroke", null);
      })


  const appIconInner = appIcon.append('xhtml:a')
    .attr('href', appIconHref)
    .style("position", "relative")
    .attr('target', '_blank')
    .style('background', 'white')
    .style('border-radius', '50%')
    .style('left', '0')
    .style('top', '0')
    .style('width', '100%')
    .style('height', '100%')
    .style('text-decoration', 'none')
    .style('color', 'black')

    .on('click', onClickAppIcon)

  // no-icon fallback
  appIconInner
    .filter(d => !d.data.icon)
    .append('xhtml:div')
    .style('font-size', '4%')
    .style('text-wrap', 'wrap')
    .style('word-break', 'break-word')
    .style('display', 'flex')
    .style('align-items', 'center')
    .style('justify-content', 'center')
    .style('text-align', 'center')
    .style('height', '100%')
    .text(d => d.data.title)


  appIconInner
    .filter(d => d.data.icon)
    .append('xhtml:img')
    .attr("xmlns", "http://www.w3.org/1999/xhtml")
    .attr('src', d => d.data.icon)
    .style("position", "absolute")

    .style("left", "15%")
    .style("top", "15%")
    .style('width', '70%')
    .style('height', '70%')

  appIconInner
    .filter(d => d.data.icon && d.data.genericIcon)
    .append('xhtml:div')
    .attr("xmlns", "http://www.w3.org/1999/xhtml")
    .style("position", "absolute")
    .style('border-radius', '50%')
    .style('background', '#FFF')
    .style('box-shadow', '0 0 3px black')
    .style('width', '48%')
    .style('height', '48%')
    .style('right', '8%')
    .style('bottom', '8%')


  appIconInner
    .filter(d => d.data.icon && d.data.genericIcon)
    .append('xhtml:img')
    .attr("xmlns", "http://www.w3.org/1999/xhtml")
    .attr('src', d => d.data.genericIcon)
    .style("position", "absolute")
    .style('width', '32%')
    .style('height', '32%')
    .style('right', '16%')
    .style('bottom', '16%')

  const icon = svg.append("g")
    .selectAll("image")
    .data(root.descendants().filter(cloudIcon))
    .join('image')
      .attr('href', cloudIcon)
      .attr('width', BASE_FONT * 2)
      .attr('height', BASE_FONT * 2)
      .attr('x', cloudIconX) // I don't understand this specific amount
      .attr('y', cloudIconY)
      .style('filter', cloudIconFilter)
      .style('pointer-events', 'none')

  function showLabel(d) {
    // don't show large label for single child
    if(d.parent?.children?.length == 1) return false

    // using a foreignObject for node labels
    if(d.data.kind == 'type') return false

    return !!toLabel(d)
  }

  const label = svg.append("g")
      .attr("color", glDark? "white": "black")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
    .selectAll("text")
    .data(root.descendants().filter(showLabel))
    .join("text")
      .style('paint-order', 'stroke')
      .style('stroke', glDark? 'black': 'white')
      .style('stroke-width', '0.1%')
      .style('stroke-linecap', 'butt')
      .style('stroke-linejoin', 'miter')
      .attr('x', labelX) // I don't understand this specific amount
      .attr('y', labelY)
      .attr('textLength', textWidthForPos)
      .style("font-size", labelSize)
      .text(toLabel);

  function updatePreviousTransform() {
      if(transform) {
        prevTransform = transform
      }
  }

  let bouncing = false

  function handleZoom(e) {
    d3.selectAll('div#chart svg g').attr('transform', e.transform)

    if(bouncing) return false
    const cloudProviderRects = Array.from(document.querySelectorAll('circle.depth-1')).map(el => el.getBoundingClientRect())
    const boundingRect = this.getBoundingClientRect()

    const outOfBoundsBy = Math.min.apply(null, cloudProviderRects.map(r => {
      return Math.min(
        r.x - boundingRect.x,
        r.y - boundingRect.y,
        boundingRect.x + boundingRect.width - (r.x + r.width),
        boundingRect.y + boundingRect.height - (r.y + r.height)
      )
    }))

    let x1 = Math.min.apply(null, cloudProviderRects.map(r => r.x))
    let y1 = Math.min.apply(null, cloudProviderRects.map(r => r.y))
    let x2 = Math.max.apply(null, cloudProviderRects.map(r => r.x + r.width))
    let y2 = Math.max.apply(null, cloudProviderRects.map(r => r.y + r.height))

    bounds = {x1, x2, y1, y2}

    const THRESHOLD = -450

    // don't bounce while we're panning zoomed or zooming in deep
    const shouldBounce = (
      outOfBoundsBy <= THRESHOLD * e.transform.k &&
      e.transform.k < 2 &&
      e.sourceEvent &&
      e.sourceEvent?.type != 'wheel'
    )

    if (shouldBounce)  {
      bouncing = true
      svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity.translate(prevTransform.x, prevTransform.y).scale(prevTransform.k)
      )
      setTimeout(() => {
        bouncing = false
      }, 750)

    } else {
      updatePreviousTransform()
    }

    transform = e.transform
    if(tooltip?.$props?.item && transform.k == prevTransform.k) {
      tooltip.$props.left += transform.x - prevTransform.x
      tooltip.$props.top += transform.y - prevTransform.y
    }
  }



  zoom = d3.zoom()
    .on('zoom', handleZoom)
  svg
    .style('user-select', 'none')
    .call(zoom)
    .on('dblclick.zoom', null)

  zoom.filter(e => {
    // if(!inBounds && e.type == 'wheel') {
    //   return false
    // }

    // don't pan with right click
    if(e.type == 'mousedown' && e.button > 0) {
      return false
    }

    return true
  })

  zoomIn = function(){
    zoom.scaleBy(svg, 4/3)
  }

  zoomOut = function(){
    zoom.scaleBy(svg, 3/4)
  }

  zoom.scaleExtent([MINIMUM_SCALE, 10])

  // wasn't able to get x or y to go above 0
  // zoom.translateExtent([[-width, -height], [width , height]])


  const result = svg.node();
  appendTo.insertBefore(result, appendTo.children[0])

  if(reserveTop) {
    zoom.translateTo(svg, 0, -reserveTop / 2, [0, 0])
  }


  zoom.scaleBy(svg, MINIMUM_SCALE)

  transform = prevTransform = {x: 0, y: (reserveTop  || 0) / 2, k: MINIMUM_SCALE}

  return result
}

// gitlab's webpack loads svgs with raw-loader (markup), vue-cli resolves them to a url
const ProviderIcons = _.mapValues({
  [lookupCloudProviderAlias('do')]: DigitalOceanIcon,
  [lookupCloudProviderAlias('aws')]: AwsIcon,
  [lookupCloudProviderAlias('gcp')]: GcpIcon,
  [lookupCloudProviderAlias('k8s')]: K8sIcon,
}, icon => icon.startsWith('<svg')?
  `data:image/svg+xml,${encodeURIComponent(icon)}`:
  icon)


function getCloudLayoutElements() {
  return {
    layout: document.querySelector('#public-cloud-layout'),
    chartPane: document.querySelector('#public-cloud-chart-pane'),
    splitter: document.querySelector('#cloud-splitter'),
  }
}

function setChartPaneHeight(height) {
  const {layout} = getCloudLayoutElements()
  if(!layout) return

  layout.style.setProperty('--cloud-chart-height', `${height}px`)
}

function setupSplitter(onResize) {
  const {layout, chartPane, splitter} = getCloudLayoutElements()
  if(!layout || !chartPane || !splitter) return
  if(splitter.dataset.initialized) return

  splitter.dataset.initialized = 'true'

  const minChartHeight = 280
  const minTableHeight = 60

  const resizeFromClientY = clientY => {
    const layoutRect = layout.getBoundingClientRect()
    const splitterRect = splitter.getBoundingClientRect()
    const offset = clientY - layoutRect.top - splitterRect.height / 2
    const maxChartHeight = layoutRect.height - splitterRect.height - minTableHeight
    const nextHeight = Math.max(minChartHeight, Math.min(offset, maxChartHeight))

    setChartPaneHeight(nextHeight)
    onResize()
  }

  const stopDrag = () => {
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', stopDrag)
  }

  const onMouseMove = event => {
    resizeFromClientY(event.clientY)
  }

  splitter.addEventListener('mousedown', event => {
    event.preventDefault()
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stopDrag)
  })
}


function mountChart(data) {
  const container = document.querySelector('div#chart')
  const chartPane = document.querySelector('#public-cloud-chart-pane')

  Array.from(container.children).forEach(child => {
    if(child.id != 'map-controls') child.remove()
  })

  const paneRect = chartPane.getBoundingClientRect()
  const width = paneRect.width
  const height = paneRect.height
  const topMargin = paneRect.top

  const BASE_PADDING = 0 // some arbitrary top padding
  const bannerReserveSpace = BASE_PADDING
  chart(container, data, width, height, bannerReserveSpace)

  container.style.height = `${height}px`

  return {topMargin, height, width}
}


function dismissWelcomeBanner() {
  welcomeBanner.style.display = 'none'
}

// the banner is part of gitlab's page chrome, absent when running standalone
function setupWelcomeBanner() {
  if(!welcomeBanner) return

  welcomeBanner.children[0].style.background = glDark?
    'radial-gradient(rgba(18, 18, 18, 0.6), rgba(18, 18, 18, 0))':
    'radial-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0))'

  const closeButton = document.querySelector('button.close')
  closeButton?.addEventListener('click', () => {
    localStorage['uc-cloud-page-dismiss'] = true
    dismissWelcomeBanner()
  })

  if(!localStorage['uc-cloud-page-dismiss']) welcomeBanner.style.display = 'unset'
}

let categoryTitles = {}

const ordering = location.search.includes('show=providers')?
[
  'cloud',
  'category',
  'type'
] :
[
  'category',
  'cloud',
  'type'
]


function identity(obj) {
  return obj.name
}

function hasGraphSelection() {
  return /(?:^|#|&)graph=/.test(window.location.hash || '')
}

function buildDemoCloudTableData() {
  return {
    name: '',
    children: [
      {
        name: 'Amazon Web Services',
        children: [
          {
            name: 'us-east-1',
            children: [
              {
                name: 'Shared Testbed',
                children: [
                  {
                    name: 'Demo Odoo Deployment',
                    visit: '/onecommons/shared-testbed/-/deployments/demo-odoo',
                  },
                  {
                    name: 'Demo Nextcloud Deployment',
                    visit: '/onecommons/shared-testbed/-/deployments/demo-nextcloud',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Google Cloud',
        children: [
          {
            name: 'us-central1',
            children: [
              {
                name: 'Playground Testbed',
                children: [
                  {
                    name: 'Demo Wordpress Deployment',
                    visit: '/onecommons/playground-testbed/-/deployments/demo-wordpress',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

export default async function initPublicCloud() {
  glDark = !!document.querySelector('.gl-dark')
  welcomeBanner = document.querySelector('#welcome-banner')

  const formattedData = await getFormattedData()
  const rawData = await getData()

  categoryTitles = _.mapValues(rawData.Overview.categories, category => category.title)
  /*
   * The bubble chart is built from two related JSON payloads:
   *
   * `rawData` is the catalog-style response from `/services/unfurl-server/types?...`.
   * We currently read:
   * - `rawData.Overview.categories[categoryKey].title`
   *   Used to convert category ids into display labels.
   *
   * `formattedData` is a flattened array derived from that response in
   * `./formatted-data`. Each entry represents one leaf in the chart and must
   * have this shape:
   * - `category`: string
   * - `cloud`: string
   * - `type`: object
   *   - `name`: string
   *   - `title`: string
   *   - optional `icon`: string
   *   - optional `genericIcon`: string
   *   - optional `description`: string
   *   - optional `details_url`: string
   *   - optional `_sourceinfo`: `{ url: string }`
   *   - optional `metadata`: object
   *     - optional `components`: Array<ResourceTypeLike>
   *       Each component item is rendered with:
   *       - `name`: string
   *       - `title`: string
   *       - plus the rest of the type object passed through to `DetectIcon`
   *
   * In the current source, the chart / tooltip code reads these leaf-node fields:
   * - chart labels/icons: `type.title`, `type.icon`, `type.genericIcon`
   * - app icon click-through: `type._sourceinfo.url`
   * - resource-type tooltip: `type.title`, `type.icon`, `type.description`,
   *   `type.details_url`, `type._sourceinfo.url`, `type.metadata.components`
   *
   * From that flat list we build the nested structure expected by `d3.pack()`:
   * - branch nodes: `{ name, kind, children }`
   * - leaf nodes: `{ ...type, kind: 'type', value: 1 }`
   *
   * `ordering` controls the hierarchy, e.g.:
   * - default: category -> cloud -> type
   * - `?show=providers`: cloud -> category -> type
   */
  function makeData(ancestors, ordering, depth=0) {
    const parentClasses = ordering.slice(0, depth)
    const currentClass = ordering[depth]
    const parent = _.last(ancestors)

    let validTypes = formattedData

    for(const [ancestor, pClass] of _.zip(ancestors.slice(1), parentClasses)) {
      validTypes = validTypes.filter(t => t[pClass] == identity(ancestor))
    }

    if(currentClass == 'type') {
      parent.children = validTypes.map(t => ({...t.type, kind: currentClass}))
    } else {
      parent.children = validTypes.map(t => ({name: t[currentClass], kind: currentClass}))
    }

    parent.children = _.uniqBy(parent.children, identity)


    if(depth < ordering.length - 1) {
      parent.children.forEach(child => {
        makeData([...ancestors, child], ordering, depth+1)
      })
    } else {
      parent.children.forEach(child => child.value = 1)
    }

    if(parent.children.length == 1) {
      if(parent.children[0].children) {
        parent.children = parent.children[0].children
      } else {
        Object.assign(parent, parent.children[0], {children: null})
      }
    }
  }

  const data = {name: '', children: []}
  makeData([data], ordering)

  setupWelcomeBanner()

  const TooltipConstructor = Vue.extend(Tooltip)
  const NavbarConstructor = Vue.extend(Navbar)
  const MapControlsConstructor = Vue.extend(MapControls)

  tooltip = new TooltipConstructor()
  navbar = new NavbarConstructor()
  const mapControls = new MapControlsConstructor()
  const lowerPaneData = buildDemoCloudTableData()

  const LowerPaneConstructor = Vue.extend({
    name: 'PublicCloudLowerPane',
    components: {
      CloudTable,
      CloudGraphInspector,
    },
    data() {
      return {
        showingInspector: hasGraphSelection(),
      }
    },
    created() {
      window.addEventListener('hashchange', this.syncWithHash)
    },
    beforeDestroy() {
      window.removeEventListener('hashchange', this.syncWithHash)
    },
    methods: {
      syncWithHash() {
        this.showingInspector = hasGraphSelection()
      },
    },
    render(createElement) {
      if(this.showingInspector) {
        return createElement(CloudGraphInspector, {
          props: {
            graph: cloudGraphData,
          },
        })
      }

      return createElement(CloudTable, {
        props: {
          data: lowerPaneData,
        },
      })
    },
  })
  const lowerPane = new LowerPaneConstructor()


  tooltip.$mount('#tooltip')
  lowerPane.$mount('#cloud-table')
  mapControls.$mount('#map-controls')

  const rerenderChart = () => {
    const {topMargin} = mountChart(data)
    navbar.$props.top = topMargin
  }

  rerenderChart()
  setupSplitter(rerenderChart)
  window.addEventListener('resize', _.debounce(rerenderChart, 500))

  mapControls.$on('zoomin', zoomIn)
  mapControls.$on('zoomout', zoomOut)
  mapControls.$on('center', setFocus)

  document.scrollingElement.style.overflow = ''
}
