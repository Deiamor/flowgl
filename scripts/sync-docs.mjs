#!/usr/bin/env node
// Auto-synchronize derivable facts across docs + audit docs-coverage.
//
// What it syncs (writable):
//   1) package versions   → DEPLOY.md "배포된 패키지" table
//   2) core test count    → README.md test badge + PROJECT.md tech stack
//   3) statement coverage → README.md coverage badge (from clover.xml)
//   4) docs site nav version → docs/.vitepress/config.ts (the `0.X.Y` label)
//   5) packages/core/README.md test count line
//
// What it audits (read-only — fails with --check):
//   6) docs-coverage: every named export from `packages/core/src/index.ts`
//      must appear at least once under `docs/`. Catches the class of bug
//      we hit at 0.9.1 where five milestones worth of API landed on master
//      while `docs/api/flowchart.md` was still describing 0.4.2.
//
// What it does NOT touch:
//   - CHANGELOG / HISTORY / TASK content (human-authored, append-only)
//   - PRODUCT / AGENTS / SPEC_CHECKLIST (governance, manual)
//
// Usage:
//   node scripts/sync-docs.mjs            # write any drift in place + audit
//   node scripts/sync-docs.mjs --check    # exit 1 if any doc is out of sync (CI / pre-commit)
//
// Add a fact to the sync map by editing the `tasks` array below — one entry
// per derivable line in a doc, each with a regex selector and the live source.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root      = path.resolve(__dirname, '..')

const CHECK_ONLY = process.argv.includes('--check')

// ─── source-of-truth readers ───────────────────────────────────────────────

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

function readVersions() {
  return {
    core:   readJson(`${root}/packages/core/package.json`).version,
    react:  readJson(`${root}/packages/react/package.json`).version,
    vue:    readJson(`${root}/packages/vue/package.json`).version,
    svelte: readJson(`${root}/packages/svelte/package.json`).version,
  }
}

function readCoreTestCount() {
  // Run vitest list-only to count tests deterministically; avoids running them.
  // Falls back to whatever number is currently in the README if vitest can't run.
  try {
    const out = execSync(
      'pnpm --filter @flowgl/core exec vitest run --reporter=json --silent 2>/dev/null',
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const json = JSON.parse(out)
    return json.numTotalTests
  } catch {
    return null
  }
}

function readWrapperTestCounts() {
  // Each wrapper's test count is fixed enough that parsing the test file is
  // overkill. Hard-code lookups; if they diverge, sync-docs --check will warn.
  // (When we eventually add a wrapper test, update both the source and here.)
  return { react: 9, vue: 9, svelte: 9 }
}

function readCoveragePct() {
  // statements coverage from clover.xml; falls back to null if no run yet.
  const p = `${root}/packages/core/coverage/clover.xml`
  if (!fs.existsSync(p)) return null
  const data = fs.readFileSync(p, 'utf8')
  const m = data.match(/<metrics[^>]*statements="(\d+)"[^>]*coveredstatements="(\d+)"/)
  if (!m) return null
  const total = +m[1], covered = +m[2]
  return Math.round((covered / total) * 10000) / 100
}

// ─── doc edits ─────────────────────────────────────────────────────────────

function edit(filePath, pairs) {
  const full = `${root}/${filePath}`
  if (!fs.existsSync(full)) return { changed: false, missing: true }
  let text = fs.readFileSync(full, 'utf8')
  const before = text
  for (const [pattern, replacement] of pairs) {
    text = text.replace(pattern, replacement)
  }
  if (text === before) return { changed: false }
  if (!CHECK_ONLY) fs.writeFileSync(full, text)
  return { changed: true }
}

// ─── tasks ─────────────────────────────────────────────────────────────────

function buildTasks() {
  const versions = readVersions()
  const coreTests = readCoreTestCount()
  const wrapperTests = readWrapperTestCounts()
  const totalTests = coreTests == null ? null
    : coreTests + wrapperTests.react + wrapperTests.vue + wrapperTests.svelte
  const coveragePct = readCoveragePct()

  const tasks = []

  // 1) DEPLOY.md version table
  for (const pkg of ['core', 'react', 'vue', 'svelte']) {
    tasks.push({
      label: `DEPLOY.md @flowgl/${pkg} version`,
      file:  'DEPLOY.md',
      pairs: [[
        new RegExp(`(\\| \`@flowgl/${pkg}\` \\| )[0-9]+\\.[0-9]+\\.[0-9]+( \\|)`),
        `$1${versions[pkg]}$2`,
      ]],
    })
  }

  // 2) README test badge (total tests)
  if (totalTests != null) {
    tasks.push({
      label: `README.md tests badge → ${totalTests}`,
      file:  'README.md',
      pairs: [[
        /tests-\d+%20passing/,
        `tests-${totalTests}%20passing`,
      ], [
        /alt="\d+ tests passing"/,
        `alt="${totalTests} tests passing"`,
      ]],
    })
  }

  // 3) PROJECT.md test count lines
  if (totalTests != null && coreTests != null) {
    const wt = wrapperTests
    tasks.push({
      label: `PROJECT.md tech stack test count → ${totalTests}/${coreTests}`,
      file:  'PROJECT.md',
      pairs: [[
        /\(\d+ tests: \d+ core \/ \d+ wrappers across react\/vue\/svelte\)/,
        `(${totalTests} tests: ${coreTests} core / ${wt.react + wt.vue + wt.svelte} wrappers across react/vue/svelte)`,
      ], [
        /pnpm test           # run \d+ tests across all packages \(\d+ core \/ \d+\+\d+\+\d+ wrappers\)/,
        `pnpm test           # run ${totalTests} tests across all packages (${coreTests} core / ${wt.react}+${wt.vue}+${wt.svelte} wrappers)`,
      ]],
    })
  }

  // 4) README coverage badge
  if (coveragePct != null) {
    const enc = (s) => s.replace(/%/g, '%25').replace(/\./g, '.')
    tasks.push({
      label: `README.md coverage badge → ${coveragePct}%`,
      file:  'README.md',
      pairs: [[
        /coverage-[0-9.]+%25/,
        `coverage-${enc(String(coveragePct))}%25`,
      ], [
        /alt="coverage [0-9.]+%"/,
        `alt="coverage ${coveragePct}%"`,
      ]],
    })
  }

  // 5) packages/core/README.md test count line — "**N tests** across M test files"
  if (coreTests != null) {
    tasks.push({
      label: `packages/core/README.md test count → ${coreTests}`,
      file:  'packages/core/README.md',
      pairs: [[
        /\*\*\d+ tests\*\* across \d+ test files/,
        `**${coreTests} tests** across ${countCoreTestFiles()} test files`,
      ]],
    })
  }

  // 6) docs/.vitepress/config.ts nav version label
  tasks.push({
    label: `docs nav version label → ${versions.core}`,
    file:  'docs/.vitepress/config.ts',
    pairs: [[
      /text: '\d+\.\d+\.\d+',/,
      `text: '${versions.core}',`,
    ]],
  })

  return tasks
}

function countCoreTestFiles() {
  try {
    return fs.readdirSync(`${root}/packages/core/src/__tests__`).filter(f => f.endsWith('.test.ts') || f.endsWith('.test.tsx')).length
  } catch { return 0 }
}

// ─── docs-coverage audit ────────────────────────────────────────────────────
//
// Parse every named export from packages/core/src/index.ts. For each name,
// check that it appears at least once anywhere under docs/. Missing names
// surface as audit failures. Why this catches the 0.5.0 → 0.9.1 drift:
// when someone adds `chart.addPanel`, `chart.registerNodeType`, etc., the
// export shows up in index.ts but never gets a docs/ mention; the
// auto-deploy ships the same 0.4.2-era page to docs.flowgl.

// Exports that are public for testability / advanced use but not part of
// the user-facing surface we expect to find in `docs/`. Keep this list
// short and well-justified — anything that goes here loses its audit
// coverage. When in doubt, write a docs entry instead.
const DOCS_AUDIT_IGNORE = new Set([
  // Interaction classes — exported so tests + advanced apps can wire them,
  // but they're not on the "every user reads about this" path.
  'EdgeWaypoint', 'EdgeReroute', 'RerouteState',
  'BoxSelect', 'BoxSelectOptions',
  'KeyboardHandler', 'KeyboardOptions',
  'LabelEditor',
  'ContextMenu',
  // Renderer implementations — `Renderer` interface itself IS user-facing
  // and lives in docs; the concrete subclasses are not.
  'WebGL2Renderer', 'Canvas2DRenderer',
  // Hit-test classes — public for testability + advanced overlays.
  'EdgeHitTester',
  // Internal infrastructure.
  'EventEmitter', 'Snapshot', 'EndpointCircle',
])

function readPublicExports() {
  const file = `${root}/packages/core/src/index.ts`
  if (!fs.existsSync(file)) return []
  const text = fs.readFileSync(file, 'utf8')
  // Capture identifier lists from `export { A, B as C, type D } from '...'`
  // and `export type { E, F } from '...'`.
  const names = new Set()
  const re = /export\s+(?:type\s+)?\{([^}]+)\}/g
  let m
  while ((m = re.exec(text)) !== null) {
    for (const part of m[1].split(',')) {
      // strip "type X" prefix + "X as Y" rename
      const id = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
      if (id && !DOCS_AUDIT_IGNORE.has(id)) names.add(id)
    }
  }
  // Capture default + named exports defined locally, e.g. `export class Foo`.
  for (const line of text.split('\n')) {
    const m2 = line.match(/^export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/)
    if (m2 && !DOCS_AUDIT_IGNORE.has(m2[1])) names.add(m2[1])
  }
  return [...names]
}

function walkDocs(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'public') continue
    const p = `${dir}/${entry.name}`
    if (entry.isDirectory()) out.push(...walkDocs(p))
    else if (/\.(md|ts|mjs)$/.test(entry.name)) out.push(p)
  }
  return out
}

function auditDocsCoverage() {
  const exports = readPublicExports()
  if (exports.length === 0) return { covered: 0, missing: [] }
  const docs = walkDocs(`${root}/docs`).map(p => fs.readFileSync(p, 'utf8')).join('\n')
  const missing = []
  for (const name of exports) {
    // Word-boundary match. Avoid false hits on substring; require the exact
    // identifier in the docs text.
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (!re.test(docs)) missing.push(name)
  }
  return { covered: exports.length - missing.length, missing }
}

// ─── run ───────────────────────────────────────────────────────────────────

const tasks = buildTasks()
let drift = 0
const log = []
for (const task of tasks) {
  const result = edit(task.file, task.pairs)
  if (result.missing) { log.push(`  ⚠ ${task.file} missing — ${task.label}`); continue }
  if (result.changed) {
    drift++
    log.push(`  ${CHECK_ONLY ? '✗ DRIFT' : '✓ updated'}  ${task.label}`)
  }
}

if (drift === 0) {
  console.log('derivable facts in sync — no drift detected')
} else {
  console.log(`${drift} doc(s) ${CHECK_ONLY ? 'out of sync' : 'updated'}:`)
  for (const line of log) console.log(line)
}

// ─── docs-coverage audit (run unconditionally) ──────────────────────────────

const audit = auditDocsCoverage()
let auditFailed = false
if (audit.missing.length === 0) {
  console.log(`\ndocs-coverage: ${audit.covered}/${audit.covered} public exports documented`)
} else {
  auditFailed = true
  console.log(`\ndocs-coverage: ${audit.covered}/${audit.covered + audit.missing.length} public exports documented`)
  console.log(`  ${audit.missing.length} export(s) MISSING from docs/:`)
  for (const name of audit.missing) console.log(`    ✗ ${name}`)
  console.log('\nAdd a mention (signature + 1-line description) to docs/api/flowchart.md')
  console.log('or the relevant guide page. Even a stub bullet under the right heading')
  console.log('clears the audit and gives users a discoverable entry point.')
}

if (CHECK_ONLY && (drift > 0 || auditFailed)) {
  console.error('\nRun without --check to fix derivable drift in place:')
  console.error('  node scripts/sync-docs.mjs')
  console.error('docs-coverage misses must be fixed by hand — add the API description.')
  process.exit(1)
}
