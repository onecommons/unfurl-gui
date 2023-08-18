const path = require('path')
const authenticityTokenRegex = /name="csrf-token"\s+content="([^"]+)"/i
function extractCsrf(document){
  try {
    const match = document.match(authenticityTokenRegex)
    return match[1]
  } catch(e) {
    console.error(e.message)
    throw new Error('Could not read authenticity token')
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  })
}

const unfurlGuiRoot = path.join(__dirname, '../../../')

module.exports = {extractCsrf, sleep, unfurlGuiRoot}
