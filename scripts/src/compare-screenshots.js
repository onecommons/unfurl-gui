#!/usr/bin/env node
/*
 * Non-blocking screenshot comparison for the Vue 3 migration baseline.
 *
 * Diffs cypress/screenshots against cypress/baseline and writes the changed
 * images (plus a diff mask) to cypress/screenshot-diffs for eyeballing in CI.
 * Exits 0 unless --strict is passed, so screenshot noise never blocks a PR
 * until a particular image has proven stable.
 *
 *   ./scripts/src/compare-screenshots.js
 *   ./scripts/src/compare-screenshots.js --strict 'route-smoke/*'
 */

const fs = require('fs')
const path = require('path')

let pixelmatch, PNG
try {
  // pixelmatch 7 is ESM-first; require() hands back the namespace object
  const pm = require('pixelmatch')
  pixelmatch = typeof pm === 'function' ? pm : pm.default
  PNG = require('pngjs').PNG
} catch (e) {
  console.error('compare-screenshots: pixelmatch and pngjs are not installed; skipping.')
  console.error('  yarn add -D pixelmatch pngjs')
  process.exit(0)
}

const ROOT = path.resolve(__dirname, '../..')
const BASELINE_DIR = path.join(ROOT, 'cypress/baseline')
const CURRENT_DIR = path.join(ROOT, 'cypress/screenshots')
const OUT_DIR = path.join(ROOT, 'cypress/screenshot-diffs')

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const patterns = args.filter(a => !a.startsWith('--'))

// Fraction of differing pixels above which an image is reported as changed.
const THRESHOLD = parseFloat(process.env.SCREENSHOT_DIFF_THRESHOLD || '0.005')
// Per-pixel colour sensitivity handed to pixelmatch.
const PIXEL_THRESHOLD = parseFloat(process.env.SCREENSHOT_PIXEL_THRESHOLD || '0.1')

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full, base)
    return entry.name.endsWith('.png') ? [path.relative(base, full)] : []
  })
}

// Cypress nests screenshots under the spec's path
// (00_visitor/route_smoke.cy.js/route-smoke/x.png). The baseline is stored
// without that prefix, so key both sides on the part after the spec segment.
function normalize(rel) {
  const parts = rel.split(path.sep)
  const i = parts.findIndex(p => p.endsWith('.cy.js'))
  return (i === -1 ? parts : parts.slice(i + 1)).join('/')
}

function matchesPattern(rel) {
  if (!patterns.length) return true
  return patterns.some(p => {
    const rx = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'))
    return rx.test(rel)
  })
}

const results = {unchanged: [], changed: [], added: [], missingBaseline: [], sizeMismatch: [], unreadable: []}

const currentByName = new Map()
for (const rel of walk(CURRENT_DIR)) currentByName.set(normalize(rel), rel)

for (const relBaseline of walk(BASELINE_DIR)) {
  const rel = normalize(relBaseline)
  if (!matchesPattern(rel)) continue
  const currentRel = currentByName.get(rel)
  if (!currentRel) {
    results.added.push(rel) // in baseline but not produced this run
    continue
  }
  const currentPath = path.join(CURRENT_DIR, currentRel)

  let baseline, current
  try {
    baseline = PNG.sync.read(fs.readFileSync(path.join(BASELINE_DIR, relBaseline)))
    current = PNG.sync.read(fs.readFileSync(currentPath))
  } catch (e) {
    results.unreadable.push(`${rel}: ${e.message}`)
    continue
  }

  // A dimension change is a real signal, but pixelmatch throws on it, so
  // report it rather than crashing the (non-blocking) step.
  if (baseline.width !== current.width || baseline.height !== current.height) {
    results.sizeMismatch.push(`${rel}: ${baseline.width}x${baseline.height} -> ${current.width}x${current.height}`)
    continue
  }

  const diff = new PNG({width: baseline.width, height: baseline.height})
  const differing = pixelmatch(
    baseline.data, current.data, diff.data,
    baseline.width, baseline.height,
    {threshold: PIXEL_THRESHOLD}
  )
  const ratio = differing / (baseline.width * baseline.height)

  if (ratio > THRESHOLD) {
    const out = path.join(OUT_DIR, rel)
    fs.mkdirSync(path.dirname(out), {recursive: true})
    fs.writeFileSync(out, PNG.sync.write(diff))
    fs.copyFileSync(currentPath, out.replace(/\.png$/, '.current.png'))
    fs.copyFileSync(path.join(BASELINE_DIR, relBaseline), out.replace(/\.png$/, '.baseline.png'))
    results.changed.push(`${rel}: ${(ratio * 100).toFixed(2)}% of pixels differ`)
  } else {
    results.unchanged.push(rel)
  }
}

const baselineNames = new Set(walk(BASELINE_DIR).map(normalize))
for (const rel of currentByName.keys()) {
  if (!matchesPattern(rel)) continue
  if (!baselineNames.has(rel)) results.missingBaseline.push(rel)
}

const report = [
  `unchanged:       ${results.unchanged.length}`,
  `changed:         ${results.changed.length}`,
  `size mismatch:   ${results.sizeMismatch.length}`,
  `no baseline yet: ${results.missingBaseline.length}`,
  `not produced:    ${results.added.length}`,
  `unreadable:      ${results.unreadable.length}`,
].join('\n')

console.log('=== screenshot comparison ===')
console.log(report)
for (const key of ['changed', 'sizeMismatch', 'missingBaseline', 'added', 'unreadable']) {
  if (results[key].length) {
    console.log(`\n--- ${key} ---`)
    results[key].forEach(line => console.log(`  ${line}`))
  }
}
if (results.changed.length || results.sizeMismatch.length) {
  console.log(`\nDiff images written to ${path.relative(ROOT, OUT_DIR)}`)
}

if (strict && (results.changed.length || results.sizeMismatch.length)) {
  console.error('\ncompare-screenshots: failing because --strict was passed.')
  process.exit(1)
}
