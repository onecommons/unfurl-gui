import fs from 'fs'

const mocks = {
  '/api/v4/projects/jest.*dashboard$': 'jest_dashboard',
  '/jest/dashboard/-/variables': 'variables',
  '/api/v4/projects/jest.*dashboard/repository/branches': 'branches',
  '/api/v4/unfurl_access_token': 'unfurl_access_token',
}

const resolvedMocks = Object.entries(mocks).map(([expr, mock]) => {
  return {
    expr: new RegExp(expr),
    mock: fs.readFileSync(`ufsv-patch/mock-responses/${mock}.json`, 'utf8')
  }
})
export function interceptWithMock(interceptUrl) {
  for(const {expr, mock} of resolvedMocks) {
    if(expr.test(interceptUrl)) {
      // console.log(`mock found for ${interceptUrl}`)
      return {
        data: JSON.parse(mock),
        status: 200
      }
    }
  }
  console.log(`mock NOT found for ${interceptUrl}`)
}
