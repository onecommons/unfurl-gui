#!/usr/bin/env node

const {GITHUB_ACCESS_TOKEN, GITHUB_USERNAME} = process.env
const path = require('path')
const fs = require('fs')
const os = require('os')
const {execSync} = require('child_process')

async function main({repository, identifier}) {
  const tmpDir = path.join(os.tmpdir(), identifier)

  /*
  try {
    fs.rmSync(tmpDir, {recursive: true, force: true})
  } catch(e) {}
  fs.mkdirSync(tmpDir)
  */

  try{
    execSync(`git clone https://${GITHUB_USERNAME}:${GITHUB_ACCESS_TOKEN}@github.com/${GITHUB_USERNAME}/${repository}`, {stdio: 'inherit', cwd: tmpDir})
  } catch(e){}

  const indexView = path.join(tmpDir, repository, 'views', 'index.pug')

  let fileContents = fs.readFileSync(indexView, {encoding: 'utf-8'})
  fileContents = fileContents.split('\n')

  fileContents.pop()
  fileContents.push(`  p ${identifier}`)

  fileContents = fileContents.join('\n')

  fs.writeFileSync(indexView, fileContents)

  try {
    execSync(`git commit -am ${identifier} && git push`, {stdio: 'inherit', cwd: path.join(tmpDir, repository)})
  } catch(e) {}


  // TODO verify incremental deployment here
}

async function tryMain() {
  const args = require('minimist')(process.argv.slice(2))

  try {
    await main({
      repository: args['repository'] || args['repo'],
      registerName: args['identifier'] || args['id'],
      ...args
    })
  } catch(e) {
    if(e.code) {
      console.error(e.code)
      console.error(e.message)
      process.exit(1)
    } else {
      console.log(e)
      console.log('Container webapp tests failed')
      process.exit(1)
    }
  }
}
tryMain()

