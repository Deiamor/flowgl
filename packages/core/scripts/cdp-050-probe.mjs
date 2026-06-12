// CDP edge-case probe for the 0.5.0 UI components.
//
// 1) Open the dev server in a fresh Brave tab via Target.createTarget.
// 2) Wait for `window.chart`.
// 3) Activate Panel + Controls + NodeToolbar + PerfOverlay + setTheme('system').
// 4) Take a screenshot of the default view.
// 5) Zoom to 4x and re-screenshot — verifies NodeToolbar constant size.
// 6) Multi-select two nodes and re-screenshot — verifies NodeToolbar auto-hide
//    rule for single-node toolbars.
// 7) Dispose check — reload, then dispose and confirm no detached DOM nodes
//    remain in the chart container.

import http from 'node:http'
import fs from 'node:fs'

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

const TARGET = process.argv[2] || 'http://localhost:5173'

async function main() {
  const ver = JSON.parse(await httpGet('/json/version'))
  const browserWs = new WebSocket(ver.webSocketDebuggerUrl)
  await new Promise((r, e) => { browserWs.onopen = r; browserWs.onerror = e })
  const sendB = makeRpc(browserWs)

  const created = await sendB('Target.createTarget', { url: TARGET })
  const targetId = created.targetId

  let tabWsUrl
  for (let i = 0; i < 30; i++) {
    const list = JSON.parse(await httpGet('/json/list'))
    const t = list.find(x => x.id === targetId)
    if (t?.webSocketDebuggerUrl) { tabWsUrl = t.webSocketDebuggerUrl; break }
    await new Promise(r => setTimeout(r, 200))
  }
  if (!tabWsUrl) throw new Error('tab ws url not resolved')

  const pageWs = new WebSocket(tabWsUrl)
  await new Promise((r, e) => { pageWs.onopen = r; pageWs.onerror = e })
  const send = makeRpc(pageWs)
  await send('Page.enable')
  await send('Runtime.enable')

  // Wait for load
  await new Promise(r => setTimeout(r, 1500))

  // Wait for window.chart with retry — vite HMR / page load can throw
  // "Execution context was destroyed" on the first eval.
  let chartReady = false
  for (let i = 0; i < 60; i++) {
    try {
      const probe = await send('Runtime.evaluate', {
        expression: 'typeof window.chart === "object"',
        returnByValue: true,
      })
      if (probe.result.value === true) { chartReady = true; break }
    } catch { /* execution context destroyed during page load, retry */ }
    await new Promise(r => setTimeout(r, 200))
  }
  if (!chartReady) throw new Error('window.chart never appeared')

  const screenshot = async (name) => {
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const path = `/tmp/050-${name}.png`
    fs.writeFileSync(path, Buffer.from(shot.data, 'base64'))
    console.log(`screenshot → ${path}`)
  }

  // Step 1: activate all four UI items + system theme + sample panel
  console.log('activating 0.5.0 UI components…')
  const activation = await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.chart
      chart.setTheme('system')
      chart.showControls({ position: 'bottom-left' })
      chart.showPerfOverlay({ position: 'top-right' })
      const panelId = chart.addPanel({
        position: 'top-center',
        content: '<b style="color:#0f172a;">flowgl 0.5.0 — Panel + Controls + NodeToolbar + PerfOverlay</b>',
        backgroundColor: '#fff',
      })
      const nodes = chart.getNodes()
      const tbIds = []
      // Per-node toolbar on every regular node — auto-visible on selection.
      for (const n of nodes) {
        if (n.type === 'group') continue
        tbIds.push(chart.addNodeToolbar({
          nodeId: n.id,
          position: 'top',
          offset: 12,
          content: '<button style="padding:2px 6px;">delete</button><button style="padding:2px 6px;">edit</button>',
        }))
      }
      return {
        panel: panelId,
        toolbars: tbIds.length,
        nodes: nodes.length,
        controls: chart.hasControls(),
        perf: chart.hasPerfOverlay(),
        theme: 'system',
      }
    })()`,
    returnByValue: true,
  })
  console.log('activation:', JSON.stringify(activation.result.value))

  await new Promise(r => setTimeout(r, 500))
  await screenshot('default')

  // Step 2: select one node → NodeToolbar should appear
  await send('Runtime.evaluate', {
    expression: `(() => {
      const id = window.chart.getNodes().find(n => n.type !== 'group')?.id
      if (!id) return null
      window.chart.setSelectedIds([id])
      return id
    })()`,
    returnByValue: true,
  })
  await new Promise(r => setTimeout(r, 400))
  await screenshot('single-select')

  // Step 3: zoom to 4x to test NodeToolbar constant-size invariant
  await send('Runtime.evaluate', {
    expression: `(() => { window.chart.zoomTo(4); return window.chart.getViewport() })()`,
    returnByValue: true,
  })
  await new Promise(r => setTimeout(r, 400))
  await screenshot('zoom-4x')

  // Step 4: multi-select 2 nodes → single-node toolbars should hide
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.chart.zoomTo(1)
      const ids = window.chart.getNodes().filter(n => n.type !== 'group').slice(0, 2).map(n => n.id)
      window.chart.setSelectedIds(ids)
      return ids
    })()`,
    returnByValue: true,
  })
  await new Promise(r => setTimeout(r, 400))
  await screenshot('multi-select')

  // Step 5: assert visible toolbar count under multi-select == 0
  const visibleAfterMulti = await send('Runtime.evaluate', {
    expression: `(() => {
      const els = document.querySelectorAll('[data-flowgl-node-toolbar]')
      let visible = 0
      for (const el of els) if (el.getAttribute('data-visible') === 'true') visible++
      return { total: els.length, visible }
    })()`,
    returnByValue: true,
  })
  console.log('multi-select toolbar visibility:', JSON.stringify(visibleAfterMulti.result.value))

  // Step 6: dispose check — count DOM nodes before/after dispose
  const disposeProbe = await send('Runtime.evaluate', {
    expression: `(() => {
      const container = window.chart.getContainer()
      const before = container.querySelectorAll('*').length
      window.chart.dispose()
      const after = container.querySelectorAll('*').length
      return { before, after, leakedOverlays: container.querySelectorAll('.flowgl-perf-overlay, [role="toolbar"], [data-flowgl-panel-id]').length }
    })()`,
    returnByValue: true,
  })
  console.log('dispose probe:', JSON.stringify(disposeProbe.result.value))

  await sendB('Target.closeTarget', { targetId })
  browserWs.close()
  pageWs.close()

  // Gates
  const v = visibleAfterMulti.result.value
  const d = disposeProbe.result.value
  let bad = 0
  if (v.visible !== 0) { console.error(`✗ single-node toolbars stayed visible under multi-select: ${v.visible}/${v.total}`); bad++ }
  if (d.leakedOverlays !== 0) { console.error(`✗ ${d.leakedOverlays} overlay element(s) leaked after dispose`); bad++ }
  if (bad === 0) console.log('ALL GATES OK')
  process.exitCode = bad === 0 ? 0 : 1
}

main().catch(e => { console.error('ERR:', e.message); process.exit(2) })
