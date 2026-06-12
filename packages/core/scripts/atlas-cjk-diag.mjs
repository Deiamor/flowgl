// CJK atlas pixel-count parity check (regression gate for the 0.2.5 known
// limitation that 0.2.6's per-entry OffscreenCanvas workaround addresses).
//
// Connects to a Chromium-family browser exposing CDP on port 9222
// (e.g. `brave-debug` shipped in this repo, or `chrome --remote-debugging-port=9222`).
// Opens a fresh tab pointed at the local dev server (http://localhost:5176),
// draws a suite of CJK / Hangul / Japanese / mixed labels through both a
// freshly-allocated OffscreenCanvas and the live chart atlas, then compares
// the nonzero-alpha pixel counts.
//
// Background: pre-0.2.6, the chart's atlas write path dropped ~57% of CJK
// glyph pixels relative to an isolated reproduction. 0.2.6's per-entry
// OffscreenCanvas + drawImage strategy was meant to fix that. This script is
// the in-frame verification that the strategy actually achieves pixel parity.
// Any divergence between `nzIso` and `nzAtlas` is a CJK regression and the
// script exits non-zero.
//
// Usage:
//   pnpm dev                                                          # one terminal
//   brave-debug                                                       # another
//   node packages/core/scripts/atlas-cjk-diag.mjs [target-url]       # this script
//
// `target-url` defaults to whatever the local Vite dev server prints.
// Falls back to http://localhost:5173 when unspecified.
import http from 'node:http'

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:9222${path}`, (res) => {
      let buf = ''
      res.on('data', c => buf += c)
      res.on('end', () => resolve(buf))
    }).on('error', reject)
  })
}

function makeRpc(ws) {
  let nextId = 1
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    }
  }
  return (method, params = {}) => {
    const id = nextId++
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  }
}

async function main() {
  // 1) Connect to the browser-level WebSocket (Target.* methods live here).
  const ver = JSON.parse(await httpGet('/json/version'))
  const browserWs = new WebSocket(ver.webSocketDebuggerUrl)
  await new Promise((r, e) => { browserWs.onopen = r; browserWs.onerror = e })
  const sendB = makeRpc(browserWs)

  // 2) Create a fresh tab.
  const targetUrl = process.argv[2] || 'http://localhost:5173'
  console.log('opening', targetUrl)
  const created = await sendB('Target.createTarget', { url: targetUrl })
  const targetId = created.targetId
  console.log('created targetId', targetId)

  // 3) Find that tab's webSocketDebuggerUrl in /json/list.
  let tabWsUrl
  for (let i = 0; i < 20; i++) {
    const list = JSON.parse(await httpGet('/json/list'))
    const t = list.find(x => x.id === targetId)
    if (t?.webSocketDebuggerUrl) { tabWsUrl = t.webSocketDebuggerUrl; break }
    await new Promise(r => setTimeout(r, 200))
  }
  if (!tabWsUrl) throw new Error('tab ws url not resolved')
  console.log('tab ws', tabWsUrl)

  const pageWs = new WebSocket(tabWsUrl)
  await new Promise((r, e) => { pageWs.onopen = r; pageWs.onerror = e })
  const send = makeRpc(pageWs)

  await send('Page.enable')
  await send('Runtime.enable')

  // 4) Wait for the chart to come up.
  await new Promise(r => setTimeout(r, 5000))

  // 5) Diagnostic: fresh OffscreenCanvas vs. live chart atlas, per CJK sample.
  const diag = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        await document.fonts.ready
        await new Promise(r => setTimeout(r, 500))
        const samples = ['Hello', '한국어', '日本語', '中文测试', 'Mixed 한글 test']
        const out = []
        const dpr = window.devicePixelRatio || 1
        for (const text of samples) {
          // (a) Fresh OffscreenCanvas — should always produce full pixel coverage.
          const ow = 200, oh = 50
          const oc = new OffscreenCanvas(Math.ceil(ow*dpr), Math.ceil(oh*dpr))
          const ec = oc.getContext('2d')
          if (dpr !== 1) ec.scale(dpr, dpr)
          ec.font = '14px system-ui'
          ec.textBaseline = 'alphabetic'
          ec.textAlign = 'center'
          ec.fillStyle = '#000'
          ec.fillText(text, ow/2, oh/2 + 5)
          const isoData = ec.getImageData(0, 0, Math.ceil(ow*dpr), Math.ceil(oh*dpr)).data
          let nzIso = 0
          for (let i = 3; i < isoData.length; i += 4) if (isoData[i] > 0) nzIso++

          // (b) Live chart atlas — reach through whichever private path exists.
          let nzAtlas = null, entry = null, atlasErr = null
          try {
            const chart = window.chart
            const candidates = [
              chart?.renderer?.textProgram?.atlas,
              chart?._renderer?.textProgram?.atlas,
              chart?.renderer?.programs?.text?.atlas,
              chart?.renderer?.text?.atlas,
            ]
            const atlas = candidates.find(Boolean)
            if (!atlas) atlasErr = 'atlas not reachable: ' + Object.keys(chart || {}).join(',')
            else {
              entry = atlas.getOrCreate(text, '14px system-ui', '#000', 200, 1.4)
              if (entry) {
                const W = atlas.offscreen.width, H = atlas.offscreen.height
                const px = atlas.ctx.getImageData(0,0, W, H).data
                const u0 = Math.round(entry.u0 * W)
                const v0 = Math.round(entry.v0 * H)
                const u1 = Math.round(entry.u1 * W)
                const v1 = Math.round(entry.v1 * H)
                nzAtlas = 0
                for (let y = v0; y < v1; y++) {
                  for (let x = u0; x < u1; x++) {
                    if (px[(y * W + x) * 4 + 3] > 0) nzAtlas++
                  }
                }
              }
            }
          } catch (e) { atlasErr = e.message }

          out.push({ text, nzIso, nzAtlas, entry, atlasErr })
        }

        // ── Stress phase ──────────────────────────────────────────────────────
        // Force the atlas to take many more entries than it normally would
        // for this demo. This used to overflow ATLAS_SIZE=1024 and trigger
        // the mid-Pass-1 eviction race that mis-mapped labels in 0.4.0.
        // After 0.4.1 (ATLAS_SIZE=2048 + Pass-1 generation re-check), every
        // labeled node's atlas entry should match an isolated reproduction of
        // its own label — regardless of how many other entries crowd the atlas.
        const chart = window.chart
        const atlas = chart?.renderer?.textProgram?.atlas
        const stress = []
        if (chart && atlas) {
          // Snapshot pre-existing nodes so we can restore later.
          const baseline = chart.getNodes().slice()
          const stressIds = []
          for (let i = 0; i < 40; i++) {
            const id = 'stress_' + i
            chart.addNode({ id, x: 80 + (i % 10) * 90, y: 600 + Math.floor(i / 10) * 70,
              width: 80, height: 40, label: 'S' + i })
            stressIds.push(id)
          }
          await new Promise(r => requestAnimationFrame(r))
          await new Promise(r => requestAnimationFrame(r))
          // Now query each labeled node's atlas entry and compare its pixel
          // count to a fresh isolated reproduction of just that node's label.
          for (const node of chart.getNodes()) {
            if (!node.label) continue
            const fontSize = node.style?.fontSize ?? 14
            const fontFamily = node.style?.fontFamily ?? 'system-ui'
            const textColor = node.style?.textColor ?? '#000'
            const lineHeight = node.style?.lineHeight ?? 1.4
            const font = fontSize + 'px ' + fontFamily
            const maxWidth = Math.max(0, node.width - 12 * 2)
            const ent = atlas.getOrCreate(node.label, font, textColor, maxWidth, lineHeight)
            if (!ent) { stress.push({ id: node.id, label: node.label, atlasNz: null, isoNz: null, reason: 'no entry' }); continue }
            const W = atlas.offscreen.width, H = atlas.offscreen.height
            const px = atlas.ctx.getImageData(0,0, W, H).data
            const u0 = Math.round(ent.u0 * W), v0 = Math.round(ent.v0 * H)
            const u1 = Math.round(ent.u1 * W), v1 = Math.round(ent.v1 * H)
            let atlasNz = 0
            for (let y = v0; y < v1; y++)
              for (let x = u0; x < u1; x++)
                if (px[(y * W + x) * 4 + 3] > 0) atlasNz++

            // Isolated repro of *this* node's label with identical font/color.
            const oc = new OffscreenCanvas(Math.ceil((node.width)*dpr), Math.ceil((node.height)*dpr))
            const ec = oc.getContext('2d')
            if (dpr !== 1) ec.scale(dpr, dpr)
            ec.font = font
            ec.textBaseline = 'alphabetic'
            ec.textAlign = 'center'
            ec.fillStyle = textColor
            ec.fillText(node.label, node.width/2, node.height/2 + 5)
            const iso = ec.getImageData(0, 0, Math.ceil(node.width*dpr), Math.ceil(node.height*dpr)).data
            let isoNz = 0
            for (let i = 3; i < iso.length; i += 4) if (iso[i] > 0) isoNz++

            stress.push({ id: node.id, label: node.label, atlasNz, isoNz, deltaPct: isoNz ? Math.round(100 * (atlasNz - isoNz) / isoNz) : null })
          }
          // Clean up stress nodes so the screenshot isn't dominated by S0..S39.
          for (const id of stressIds) chart.removeNode(id)
          await new Promise(r => requestAnimationFrame(r))
        }

        return {
          dpr,
          fontsStatus: document.fonts.status,
          chartExists: !!window.chart,
          chartKeys: window.chart ? Object.getOwnPropertyNames(window.chart).slice(0, 20) : null,
          rendererKeys: window.chart?.renderer ? Object.getOwnPropertyNames(window.chart.renderer).slice(0, 20) : null,
          stress,
          results: out,
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  })
  const value = diag.result.value
  console.log('DIAG:')
  console.log(JSON.stringify(value, null, 2))

  // Parity gate — every sample's nzIso must equal nzAtlas.
  const mismatches = (value.results || []).filter(r => r.nzAtlas !== r.nzIso)
  if (mismatches.length > 0) {
    console.error('CJK PARITY FAILED for', mismatches.length, 'samples')
    process.exitCode = 1
  } else {
    console.log('CJK PARITY OK — all', value.results.length, 'samples match isolated reproduction')
  }

  // Stress gate — every labeled node's atlas entry must match its own
  // isolated reproduction. Mismatch here is the 0.4.0 mis-mapping regression.
  const stressBad = (value.stress || []).filter(s =>
    s.atlasNz === null || s.isoNz === null || Math.abs((s.deltaPct ?? 100)) > 5
  )
  if (stressBad.length > 0) {
    console.error('ENTRY MAPPING FAILED for', stressBad.length, 'nodes:')
    for (const b of stressBad.slice(0, 10)) console.error('  ', JSON.stringify(b))
    process.exitCode = 1
  } else {
    console.log('ENTRY MAPPING OK — all', (value.stress || []).length, 'labeled nodes survive atlas overflow')
  }

  // 6) Screenshot full page.
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  const fs = await import('node:fs')
  fs.writeFileSync('/tmp/cjk-current.png', Buffer.from(shot.data, 'base64'))
  console.log('screenshot → /tmp/cjk-current.png')

  // 7) Close that tab.
  await sendB('Target.closeTarget', { targetId })

  browserWs.close()
  pageWs.close()
}

main().catch(e => { console.error('ERR:', e.message, e.stack); process.exit(1) })
