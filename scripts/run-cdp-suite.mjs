// Sequentially run the 0.5.0–0.8.1 CDP probe scripts against a freshly
// booted Chromium driven by Playwright with --remote-debugging-port.
// The probes themselves connect to that CDP endpoint on port 9222.
// On any probe failure this script exits non-zero so CI surfaces the
// breakage.

import { spawn } from 'node:child_process'
import { setTimeout as wait } from 'node:timers/promises'
import http from 'node:http'

const PROBES = [
  'packages/core/scripts/cdp-050-probe.mjs',
  'packages/core/scripts/cdp-060-probe.mjs',
  'packages/core/scripts/cdp-060-interactive-probe.mjs',
  'packages/core/scripts/cdp-070-probe.mjs',
  'packages/core/scripts/cdp-080-probe.mjs',
  'packages/core/scripts/cdp-081-probe.mjs',
]

const PORT = 4173
const CDP_PORT = 9222

function startPreview() {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['--filter', 'demo', 'preview', '--port', String(PORT), '--strictPort'], {
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let resolved = false
    const settleOnce = () => { if (!resolved) { resolved = true; resolve(child) } }
    child.stdout.on('data', (c) => {
      if (c.toString().includes(`localhost:${PORT}`)) settleOnce()
    })
    // HTTP-probe fallback: pnpm sometimes buffers vite's stdout enough that
    // the "Local:" line never makes it back to us, but the server is up.
    // Poll the port for 90 s and resolve as soon as a 200 lands.
    const start = Date.now()
    const poll = () => {
      if (resolved) return
      const req = http.get(`http://localhost:${PORT}/`, (res) => { res.resume(); if (res.statusCode === 200) settleOnce() })
      req.on('error', () => {})
      req.setTimeout(800, () => req.destroy())
      if (Date.now() - start > 90000) reject(new Error('preview did not start within 90 s'))
      else setTimeout(poll, 1500)
    }
    setTimeout(poll, 3000)
  })
}

async function waitForCdp(retries = 30) {
  for (let i = 0; i < retries; i++) {
    const ok = await new Promise((res) => {
      const req = http.get(`http://localhost:${CDP_PORT}/json/version`, (r) => { r.resume(); res(r.statusCode === 200) })
      req.on('error', () => res(false))
      req.setTimeout(1000, () => { req.destroy(); res(false) })
    })
    if (ok) return true
    await wait(500)
  }
  return false
}

async function startChromium() {
  const { chromium } = await import('playwright')
  // Launch with CDP exposed. The probes connect via http://localhost:9222.
  const browser = await chromium.launch({
    headless: true,
    args: [`--remote-debugging-port=${CDP_PORT}`, '--no-sandbox'],
  })
  return browser
}

function runProbe(path) {
  return new Promise((resolve) => {
    const child = spawn('node', [path, `http://localhost:${PORT}/`], { stdio: 'inherit' })
    child.on('exit', (code) => resolve(code ?? 1))
  })
}

async function main() {
  console.log('boot preview + chromium')
  const preview = await startPreview()
  const browser = await startChromium()
  const ok = await waitForCdp()
  if (!ok) {
    console.error('CDP endpoint never came up')
    await browser.close()
    preview.kill()
    process.exit(2)
  }

  let bad = 0
  for (const p of PROBES) {
    console.log(`\n── ${p} ──`)
    const code = await runProbe(p)
    if (code !== 0) { console.error(`✗ ${p} exited ${code}`); bad++ }
    else console.log(`✓ ${p}`)
    await wait(1000)
  }

  await browser.close()
  preview.kill()

  console.log(bad === 0 ? '\nALL CDP PROBES OK' : `\n${bad} CDP PROBES FAILED`)
  process.exit(bad === 0 ? 0 : 1)
}

main().catch((e) => { console.error('ERR:', e.message); process.exit(2) })
