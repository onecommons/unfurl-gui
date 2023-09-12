#!/usr/bin/env node
const fs = require('fs')

function keepEntry(e) {
  return !denyEntry(e)
}

function denyEntry(e) {
  if(['stylesheet', 'font', 'script', 'image', 'websocket', 'other', 'manifest'].includes(e._resourceType)) return true
}

function main() {
  const args = require('minimist')(process.argv.slice(2))

  for(const arg of args._) {
    const har = JSON.parse(fs.readFileSync(arg, 'utf-8'))
    console.log(har.log.entries.length)
    const kept = har.log.entries.filter(keepEntry)

    kept.forEach(e => {
      delete e.request.headers
      delete e.request.cookies

      delete e.response.headers
      delete e.response.cookies
    })

    har.log.entries = kept

    fs.writeFileSync(arg, JSON.stringify(har))
  }
}

try {
  main()
} catch(e) {
  console.error(e.message)
}
