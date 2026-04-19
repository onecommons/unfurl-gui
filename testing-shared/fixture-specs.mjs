const SPEC_GLOBS = process.env.SPEC_GLOBS || ''
const SKIP_GLOBS = process.env.SPEC_SKIP_GLOBS || '*container-webapp* *nestedcloud* *draft*'
const TEST_VERSIONS = process.env.TEST_VERSIONS || 'v2'

function evalGlobs(globs, prefix, suffix) {
  return globs.split(/\s+/).map(
    spec => {
      const s = `${prefix}${spec}${suffix}`
      return globSync(`${prefix}${spec}${suffix}`)
    }
  ).flat()
}

import glob from 'glob'
const globSync = glob.sync


function fixturesOrSpecsFor(prefix, suffix) {
  const includeFixtures = evalGlobs(SPEC_GLOBS, prefix, suffix)
  const skipFixtures = evalGlobs(SKIP_GLOBS, prefix, suffix)

  return includeFixtures.filter(f => !skipFixtures.includes(f))
}

export function getBlueprintSpecs() {
  return fixturesOrSpecsFor('cypress/e2e/blueprints/', '.cy.js')
}

export function getBlueprintFixtures() {
  return fixturesOrSpecsFor(`cypress/fixtures/generated/deployments/${TEST_VERSIONS}/`, '.json')
}
