const mkdirp = require('mkdirp')
const path = require('path')
const os = require('os')
const fs = require('fs')

const tmpDir = path.join(os.tmpdir(), '.unfurl-gui')
const logDir = path.join(tmpDir, 'logs')

mkdirp.sync(logDir)

function getPid(program) {
  try{
    return fs.readFileSync(path.join(tmpDir, `${program}.pid`), {encoding: 'utf-8'})
  } catch(e) { console.error(e)}
}

function isPidRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch(e) {
    return false
  }
}

function isProgramRunning(program) {
  return isPidRunning(getPid(program))
}

function getLogWriter(program) {
  const log = fs.createWriteStream(path.join(logDir, `${program}.log`), {flags: 'a'})
  return function (line) {log.write(line + '\n')}
}

module.exports = {getLogWriter, isProgramRunning, isPidRunning, getPid, logDir, tmpDir}
