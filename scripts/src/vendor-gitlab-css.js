#!/usr/bin/env node
/*
 * Vendor GitLab's compiled stylesheets into public/assets.
 *
 * The standalone build has no Rails asset pipeline, so public/*.html links a
 * snapshot of the fork's CSS. That snapshot was taken from 15.11 and is what
 * global.css has been shimming around; this pulls it from the 19.3 target
 * instead, where @gitlab/ui 136's own component CSS actually ships.
 *
 * 19.3 changed the set: application_utilities is gone, replaced by a
 * separately linked tailwind.css, and the two themed sheets are the whole
 * light/dark story (see app/views/layouts/_head.html.haml there).
 *
 *   ./scripts/src/vendor-gitlab-css.js [path-to-gdk-gitlab]
 *
 * Names are written without a digest on purpose: the shells link them by
 * plain name, so a later refresh is a file swap and touches no HTML.
 */

const fs = require('fs')
const path = require('path')
const postcss = require('postcss')
const cssnano = require('cssnano')

const GDK = process.argv[2] || process.env.GDK_PATH || '/Users/adam/_dev/gdk-oc/gitlab'
const BUILDS = path.join(GDK, 'app/assets/builds')
const OUT = path.resolve(__dirname, '../../public/assets')

// `white` is the highlight theme the shells already used; keep it so syntax
// highlighting does not change meaning in this refresh.
const SHEETS = [
  'application.css',
  'application_dark.css',
  'tailwind.css',
  'fonts.css',
  ['highlight/themes/white.css', 'highlight-white.css'],
]

/*
 * fonts.css declares four faces; only GitLab Mono is ever used.
 *
 * The fork sets --default-regular-font to "Noto Sans" and serves those faces
 * from /oc/assets/fonts, so GitLab Sans is never requested (670 KiB we do not
 * need). It leaves --default-mono-font unset, so `code, kbd, pre, samp` fall
 * back to "GitLab Mono" -- which 404'd here until this copied it.
 */
const FONT_DIRS = ['gitlab-mono']

async function copyFonts(gdk) {
  const src = path.join(gdk, 'node_modules/@gitlab/fonts')
  if (!fs.existsSync(src)) {
    console.log('  SKIP    fonts (@gitlab/fonts not installed in the GDK checkout)')
    return
  }
  for (const dir of FONT_DIRS) {
    const from = path.join(src, dir)
    if (!fs.existsSync(from)) continue
    const to = path.join(OUT, dir)
    fs.mkdirSync(to, {recursive: true})
    for (const file of fs.readdirSync(from)) {
      if (!file.endsWith('.woff2')) continue
      fs.copyFileSync(path.join(from, file), path.join(to, file))
      const kib = fs.statSync(path.join(to, file)).size / 1024
      console.log(`  ${(dir + '/' + file).padEnd(24)} ${kib.toFixed(0).padStart(9)} KiB`)
    }
  }
}

async function main() {
  if (!fs.existsSync(BUILDS)) {
    console.error(`no compiled stylesheets at ${BUILDS}`)
    console.error('Point at a GDK checkout whose assets have been built.')
    process.exit(1)
  }

  const version = fs.existsSync(path.join(GDK, 'VERSION'))
    ? fs.readFileSync(path.join(GDK, 'VERSION'), 'utf8').trim()
    : 'unknown'
  console.log(`source: ${GDK} (GitLab ${version})\n`)

  for (const entry of SHEETS) {
    const [rel, outName] = Array.isArray(entry) ? entry : [entry, entry]
    const src = path.join(BUILDS, rel)
    if (!fs.existsSync(src)) {
      console.log(`  SKIP    ${rel} (not built)`)
      continue
    }
    const css = fs.readFileSync(src, 'utf8')
    /*
     * map:false matters. These builds carry a sourceMappingURL, and postcss
     * otherwise inlines the map into the output -- which made a 5 MiB sheet
     * come out at 11 MiB rather than the 943 KiB it should be.
     */
    const result = await postcss([cssnano({preset: 'default'})])
      .process(css, {from: undefined, map: false})

    fs.writeFileSync(path.join(OUT, outName), result.css)
    const kib = n => `${(n / 1024).toFixed(0)} KiB`
    console.log(`  ${outName.padEnd(24)} ${kib(css.length).padStart(9)} -> ${kib(result.css.length).padStart(8)}`)
  }

  await copyFonts(GDK)

  console.log('\nLink these from public/*.html, and put the colour mode on <html>:')
  console.log('  <html class="gl-dark">   (19.3 uses gl-light / gl-dark / gl-system)')
}

main().catch(e => {
  console.error(e.message)
  process.exit(1)
})
