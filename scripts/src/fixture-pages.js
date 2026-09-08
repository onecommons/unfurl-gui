/*
 * Pages that exist to give the cypress specs something to mount.
 *
 * They are real build entries because the components they render appear on no
 * standalone route -- the four in fork-inputs are compiled out of the app
 * entirely (`#!if !standalone`), so without a page they would be rewritten
 * with nothing watching.
 *
 * Everything they own is emitted under a `fixtures/` directory so the release
 * tarball can leave it out: CI compiles once and ships the same dist/ it
 * tested, and these are not part of the product. Chunks the app also uses stay
 * where they are -- both sides need them, and they ship either way.
 */

const PAGES = {
  'form-fixture': {
    entry: 'src/pages/form-fixture/index.js',
    // Mounts oc_inputs.vue against a synthetic schema with a stub store, so
    // the formily layer can be exercised without a server.
  },
  gallery: {
    entry: 'src/pages/gallery/index.js',
    // Components 2A.2 rewrites that render on no route the specs visit.
  },
  'dev-settings': {
    entry: 'src/pages/dev-settings/index.js',
    // experimental-settings-indicator needs gon.unfurl_gui false, which
    // cannot share a page with the gallery.
  },
  'fork-inputs': {
    entry: 'src/pages/fork-inputs/index.js',
    // The four fork-only inputs. Also needs gon.unfurl_gui false.
  },
}

const NAMES = Object.keys(PAGES)

/*
 * A chunk belongs under fixtures/ only if every runtime that pulls it is a
 * fixture entry. Async chunks carry a RuntimeSpec -- a string for one entry, a
 * set for several -- and a chunk shared with the app must keep its normal path
 * so the app's own HTML still resolves it.
 */
function isFixtureOnly(chunk) {
  const runtime = chunk && chunk.runtime
  if (!runtime) return false
  const owners = typeof runtime === 'string' ? [runtime] : [...runtime]
  return owners.length > 0 && owners.every(name => NAMES.includes(name))
}

module.exports = {PAGES, NAMES, isFixtureOnly, DIR: 'fixtures'}
