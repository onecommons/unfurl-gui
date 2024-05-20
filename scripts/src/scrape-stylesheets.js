const {JSDOM} = require('jsdom')
const fs = require('fs')
const path = require('path')
const pretty = require('pretty')
const axios = require('axios')
const _ = require('lodash')
const {unfurlGuiRoot} = require('./shared/util')

const args = require('minimist')(process.argv.slice(2))

let {upstream} = args

const indexFile = path.join(unfurlGuiRoot, 'public/index.html')
const publicDir = path.join(unfurlGuiRoot, 'public')

function transformHref(href) {
  let relative = (new URL(href)).pathname
  return `/assets/${path.basename(relative)}`
}

async function download(href) {
  console.log('download', {href})
  const destination = path.join(publicDir, transformHref(href))

  const {data} = await axios.get(href)
   
  await fs.promises.writeFile(destination, data)
}

function shouldKeepStyle(style) {
  const content = style.innerHTML
  return (
    !content.includes('BEM support Func')
      && !content.includes('[data-v-')
  )

}

async function main() {
  const ufcloud = await JSDOM.fromURL(upstream)
  const index = new JSDOM(fs.readFileSync(indexFile, 'utf-8'))

  const styles = Array.from(ufcloud.window.document.querySelectorAll('style')).filter(shouldKeepStyle)
  const links = ufcloud.window.document.querySelectorAll('link[href$=".css"]')

  index.window.document.querySelectorAll('link[href$=".css"]').forEach(l => l.remove())
  index.window.document.querySelectorAll('style').forEach(s => s.remove())
  index.window.document.head.childNodes.forEach(node => {
    if(node.nodeType == 3) {
      node.remove()
    }

  })

  await Promise.all(_.uniq(Array.from(links).map(l => l.href)).map(download))

  links.forEach(l => {
    l.rel = 'stylesheet'
    l.href = transformHref(l.href)
    index.window.document.head.appendChild(l)
  })
  styles.forEach(s => index.window.document.head.appendChild(s))

  fs.writeFileSync(indexFile, pretty(index.serialize()))
}

main()
