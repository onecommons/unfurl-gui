#!/usr/bin/env node

const child_process = require('child_process')
const fs = require('fs')

async function scanToFirstInRange({host, min, max, batchSize, timeout}) {
  const DEFAULT_BATCH_SIZE=10
  let promises = []
  let subprocesses = []
  for(let i = min; i <= max; i++) {
    function scan() {
      return new Promise((resolve, reject) => {
        n = child_process.spawn('nc', [host, i, '-w', timeout, '-W', 1])
        subprocesses.push(n)
        n.on('exit', code => {
          if(code) reject()
          else resolve(i)
        })
      })
    }
    promises.push(scan())
    if(promises.length >= (batchSize || DEFAULT_BATCH_SIZE)) {
      try {
        const any = await Promise.any(promises)
        if(any) return any
      } catch(e) {
        promises = []
      } finally {
        subprocesses
          .filter(sp => sp.exitCode === null)
          .forEach(sp => sp.kill())
        subprocesses = []
      }
    }
  }
  let port

  try {
    port = await Promise.any(promises)
  } catch(e) {}

  subprocesses
    .filter(sp => sp.exitCode === null)
    .forEach(sp => sp.kill())

  if(port) return port
}

function ping({host, attempts, timeout}) {
  return new Promise((resolve, reject) => {
    n = child_process.spawn('ping', ['-c', attempts, '-W', timeout, host])
    n.on('exit', code => {
      resolve(code === 0)
    })
  })
}

const subcommands = {
  async aws(args) {
    const input = JSON.parse(fs.readFileSync(0, 'utf-8'))
    const changes = (await Promise.all(
      input.ResourceRecordSets
      .filter(rrs => rrs.Type == 'A' && rrs.ResourceRecords.length == 1)
      .map(rrs => (async function() { return [rrs, await scanToFirstInRange({host: rrs.ResourceRecords[0].Value, ...args})]})())
    ))
      .filter(([rrs, port]) => {
        if(port) console.error('keeping', rrs.Name)
        return !port
      })
      .map(([rrs]) => ({"Action": "DELETE", "ResourceRecordSet": rrs}))
    console.log([
      `aws route53 change-resource-record-sets --hosted-zone-id ${args['hosted-zone-id']} --change-batch file://<(cat <<EOF`,
      JSON.stringify({
        'Comment': args.comment,
        'Changes': changes
      }, null, 2),
      'EOF)'
    ].join('\n'))
  },
  async gcp(args) {
    let input = fs.readFileSync(0, 'utf-8')
      .split('\n')
      .map(line => line.split(/\s+/))
      .slice(1)
      .filter(line => line[1] == 'A')

    input = (await Promise.all(
      // drop lines with successful pings
      input.map(async line => {
        if(await ping({host: line[0].slice(0, -1), attempts: 3, ...args})) {
          console.error('keeping', line)
        } else {
          return line
        }
      })
    ))

    input = input.filter(line => !!line)
      
    if(input.length == 0) return

    const zone = input[0][0].split('.').slice(-3, -1).join('-')

    input.forEach(line => {
      console.log(`gcloud dns record-sets delete ${line[0]} --zone ${zone} --type A`)
    })
  }
}

async function main() {
  let args = require('minimist')(process.argv.slice(2))
  args = {comment: 'batch delete unused', batchSize: 1, min: 22, max: 22, timeout: 5, ...args}
  
  const subcommand = subcommands[args._[0]]
  if(typeof subcommand == 'function') {
    subcommand(args)
  }
}

main()
