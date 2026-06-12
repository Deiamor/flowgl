#!/usr/bin/env node
// Headless benchmark driver.
//
// Starts the demo Vite dev server, opens benchmark.html in a headless
// Chromium (via Playwright), calls window.__flowglBenchmark.run() with the
// canonical T6 sizes (1K / 5K / 10K), writes the JSON result to
// docs/data/benchmarks.json (append) and to stdout.
//
// Exits non-zero if any size drops below its T6 floor:
//   1K:  floor 60 fps
//   5K:  floor 30 fps (target 60)
//   10K: floor 30 fps
//
// Usage:
//   node scripts/run-benchmark.mjs                     # writes result + checks floors
//   node scripts/run-benchmark.mjs --counts 1000,5000  # custom sizes
//   node scripts/run-benchmark.mjs --no-write          # dry-run (stdout only)
//
// Dependencies: this script imports playwright at runtime. It's a devDep
// of the workspace root; install with `pnpm install -w -D playwright` if
// missing. The benchmark itself runs in headless Chromium with SwiftShader
// — that's how PERFORMANCE.md numbers are produced.

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root      = path.resolve(__dirname, '..')

const args     = process.argv.slice(2)
const noWrite  = args.includes('--no-write')
const countsIx = args.indexOf('--counts')
const counts   = countsIx >= 0
  ? args[countsIx + 1].split(',').map(n => +n)
  : [1000, 5000, 10000]

const FLOORS = { 1000: 60, 5000: 30, 10000: 30 }

let playwright
try {
  playwright = (await import('playwright')).chromium
} catch {
  console.error('playwright not installed. Run: pnpm install -w -D playwright && pnpm exec playwright install chromium')
  process.exit(2)
}

// Build the demo first, then serve the static dist via `vite preview` — much
// more reliable in CI than `vite dev`, whose stdout can be buffered through
// pnpm's wrapper and produces a "did not start" timeout even when the server
// is actually up. The build adds ~5s but the preview server has a fixed
// startup signature and a published default port.
const PREVIEW_PORT = 4173
console.log('building demo for benchmark…')
await new Promise((resolve, reject) => {
  const build = spawn('pnpm', ['--filter', 'demo', 'build'], { cwd: root, stdio: 'inherit' })
  build.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`demo build failed: ${code}`)))
})

const vite = spawn('pnpm', ['--filter', 'demo', 'preview', '--', '--port', String(PREVIEW_PORT)], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let viteUrl = null
const VITE_TIMEOUT_MS = 60_000
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`vite preview did not start in ${VITE_TIMEOUT_MS / 1000}s`)), VITE_TIMEOUT_MS)
  // Stream stdout for the Local: URL.
  const onChunk = (chunk) => {
    const text = chunk.toString()
    const m = text.match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/)
    if (m && !viteUrl) {
      viteUrl = `http://localhost:${m[1]}`
      clearTimeout(timer)
      resolve()
    }
  }
  vite.stdout.on('data', onChunk)
  vite.stderr.on('data', onChunk)
  // Belt-and-braces fallback — poll the well-known port. `vite preview` always
  // binds the same port (PREVIEW_PORT) and tends to print before binding, so a
  // 2s grace + GET / is enough to confirm the server is ready even if stdout
  // got swallowed.
  setTimeout(async () => {
    if (viteUrl) return
    try {
      const res = await fetch(`http://localhost:${PREVIEW_PORT}/`)
      if (res.ok && !viteUrl) {
        viteUrl = `http://localhost:${PREVIEW_PORT}`
        clearTimeout(timer)
        resolve()
      }
    } catch { /* still booting */ }
  }, 2_000)
})
console.log('vite ready', viteUrl)

const browser = await playwright.launch({
  headless: true,
  // SwiftShader matches the PERFORMANCE.md baseline — real GPU runners
  // will outperform this, which is fine; we only floor-check.
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await page.goto(`${viteUrl}/benchmark.html`, { waitUntil: 'load' })

  console.log('running counts', counts.join(', '))
  const result = await page.evaluate(async (cs) => {
    return await window.__flowglBenchmark.run(cs)
  }, counts)

  console.log(JSON.stringify(result, null, 2))

  if (!noWrite) {
    const out = path.join(root, 'docs', 'data', 'benchmarks.json')
    fs.mkdirSync(path.dirname(out), { recursive: true })
    let archive = []
    if (fs.existsSync(out)) {
      try { archive = JSON.parse(fs.readFileSync(out, 'utf8')) } catch {}
    }
    archive.push(result)
    fs.writeFileSync(out, JSON.stringify(archive, null, 2) + '\n')
    console.log('wrote', out)
  }

  let belowFloor = false
  for (const r of result.results) {
    const floor = FLOORS[r.count]
    if (floor != null && r.avgFps < floor) {
      console.error(`✗ ${r.count} nodes: ${r.avgFps.toFixed(1)} fps < floor ${floor}`)
      belowFloor = true
    } else {
      console.log(`✓ ${r.count} nodes: ${r.avgFps.toFixed(1)} fps (floor ${floor ?? '—'})`)
    }
  }

  await browser.close()
  vite.kill()

  if (belowFloor) {
    console.error('\nBenchmark FAILED — at least one size below T6 floor.')
    process.exit(1)
  }
} catch (e) {
  console.error('benchmark error:', e.message)
  await browser.close().catch(() => {})
  vite.kill()
  process.exit(2)
}
