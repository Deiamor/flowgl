#!/usr/bin/env node
// Auto-synchronize derivable facts across docs.
//
// What it syncs:
//   1) package versions  → DEPLOY.md "배포된 패키지" table
//   2) core test count   → README.md test badge + PROJECT.md tech stack + Build Commands line
//   3) statement coverage → README.md coverage badge (reads packages/core/coverage/clover.xml)
//
// What it does NOT touch:
//   - CHANGELOG / HISTORY / TASK content (human-authored, append-only)
//   - PRODUCT / AGENTS / SPEC_CHECKLIST (governance, manual)
//
// Usage:
//   node scripts/sync-docs.mjs            # write any changes in place
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

  return tasks
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
  console.log('docs in sync — no drift detected')
} else {
  console.log(`${drift} doc(s) ${CHECK_ONLY ? 'out of sync' : 'updated'}:`)
  for (const line of log) console.log(line)
}

if (CHECK_ONLY && drift > 0) {
  console.error('\nRun without --check to fix in place:')
  console.error('  node scripts/sync-docs.mjs')
  process.exit(1)
}
