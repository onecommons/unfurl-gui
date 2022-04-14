const path = require('path')
const authenticityTokenRegex = /name="csrf-token"\s+content="(([A-Za-z0-9+/=])+)"/i
function extractCsrf(document){
  try {
    return document.match(authenticityTokenRegex)[1]
  } catch(e) {
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
