/*
 * Pages that exist to give the cypress specs something to mount.
 *
 * They are real build entries because the components they render appear on no
 * standalone route -- the four in fork-inputs are compiled out of the app
 * entirely (`#!if !standalone`), so without a page they would be rewritten
 * with nothing watching.
 *
 * They compile separately from the app (FIXTURE_BUILD=1, see vue.config.js)
 * into dist/fixtures/, which the release tarball leaves out. Sharing the app's
 * compilation made them part of its chunk graph instead: gallery/store.js
 * shipped inside chunk-common on every page, and the split it forced cost the
 * product 3-8 KiB gzipped per page.
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

module.exports = {PAGES, DIR: 'fixtures'}
