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

module.exports = {extractCsrf, sleep}
