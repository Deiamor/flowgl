// Cross-browser smoke test driven by Playwright. Boots the built demo
// in Chromium / Firefox / WebKit, asserts that the chart constructor
// runs without error and a canvas is mounted. Used by the
// `browser-matrix` workflow to catch wrapper / vendor / feature-
// detection breakage that the happy-dom unit tests cannot see.

import { spawn } from 'node:child_process'
import http from 'node:http'

const BROWSER = process.env.BROWSER || 'chromium'
const PORT = 4173

function startPreview() {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['--filter', 'demo', 'preview', '--port', String(PORT), '--strictPort'], {
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let buf = ''
    const onChunk = (c) => {
      buf += c.toString()
      if (buf.includes(`localhost:${PORT}`)) {
        resolve(child)
      }
    }
    child.stdout.on('data', onChunk)
    child.on('error', reject)
    setTimeout(() => {
      probe().then((ok) => { if (ok) resolve(child) }).catch(() => {})
    }, 4000)
    setTimeout(() => reject(new Error('preview did not start within 30 s')), 30000)
  })
}

function probe() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}/`, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => { req.destroy(); resolve(false) })
  })
}

async function run() {
  const { chromium, firefox, webkit } = await import('playwright')
  const launcher = { chromium, firefox, webkit }[BROWSER]
  if (!launcher) throw new Error(`Unknown BROWSER: ${BROWSER}`)

  const preview = await startPreview()
  let server = null
  const cleanup = (code) => {
    try { preview.kill() } catch {}
    if (server) { try { server.kill() } catch {} }
    process.exit(code)
  }

  try {
    const browser = await launcher.launch({ headless: true })
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`) })

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 30000 })

    // The demo mounts window.chart once the FlowChart constructor returns.
    await page.waitForFunction(() => typeof window.chart === 'object' && !!window.chart.getNodes, { timeout: 20000 })

    const summary = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      const ctx = canvas?.getContext('webgl2') ?? canvas?.getContext('2d') ?? null
      return {
        hasCanvas: !!canvas,
        canvasWidth: canvas?.width ?? 0,
        canvasHeight: canvas?.height ?? 0,
        ctxKind: ctx?.constructor?.name ?? null,
        nodeCount: window.chart?.getNodes().length ?? -1,
        edgeCount: window.chart?.getEdges().length ?? -1,
      }
    })

    console.log(`[${BROWSER}] summary:`, JSON.stringify(summary))

    let bad = 0
    if (!summary.hasCanvas) { console.error(`[${BROWSER}] ✗ no canvas mounted`); bad++ }
    if (summary.nodeCount < 0) { console.error(`[${BROWSER}] ✗ window.chart did not initialise`); bad++ }
    if (errors.length) { console.error(`[${BROWSER}] ✗ page errors:`, errors.join('\n  ')); bad++ }

    await browser.close()

    if (bad === 0) console.log(`[${BROWSER}] ✓ smoke OK`)
    cleanup(bad === 0 ? 0 : 1)
  } catch (err) {
    console.error(`[${BROWSER}] ERR:`, err.message)
    cleanup(2)
  }
}

run()
