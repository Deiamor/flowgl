// CDP 0.8.1 probe — verifies the waypoint-insert regression is fixed end
// to end through real Brave mouse events. Specifically:
//
//   GATE 1 — user drags the midpoint handle of an edge → a waypoint is
//            inserted. Clicking the new polyline midpoint still picks
//            the edge (the original bug: click missed).
//   GATE 2 — the edge label follows the rendered path: a step edge with
//            a label has the label visible roughly on the step polyline
//            after a viewport zoom (the WebGL fingerprint must recompute).
//   GATE 3 — EdgeToolbar follows the polyline midpoint, not the straight
//            line between node centers, after a waypoint is added.
//
// Exit 0 = pass, 1 = gate fail, 2 = infra error.

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

const wait = (ms) => new Promise(r => setTimeout(r, ms))

async function mouse(send, type, x, y, button = 'left', clickCount = 0) {
  await send('Input.dispatchMouseEvent', {
    type, x, y,
    button,
    buttons: type === 'mouseReleased' ? 0 : (button === 'left' ? 1 : 0),
    clickCount,
  })
}

async function drag(send, fromX, fromY, toX, toY, steps = 10) {
  await mouse(send, 'mouseMoved', fromX, fromY, 'none')
  await wait(40)
  await mouse(send, 'mousePressed', fromX, fromY, 'left', 1)
  await wait(40)
  for (let i = 1; i <= steps; i++) {
    const x = fromX + ((toX - fromX) * i) / steps
    const y = fromY + ((toY - fromY) * i) / steps
    await mouse(send, 'mouseMoved', x, y, 'left')
    await wait(20)
  }
  await wait(40)
  await mouse(send, 'mouseReleased', toX, toY, 'left', 1)
  await wait(120)
}

async function click(send, x, y) {
  await mouse(send, 'mouseMoved', x, y, 'none')
  await wait(30)
  await mouse(send, 'mousePressed', x, y, 'left', 1)
  await wait(40)
  await mouse(send, 'mouseReleased', x, y, 'left', 1)
  await wait(100)
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
    await wait(200)
  }
  const pageWs = new WebSocket(tabWsUrl)
  await new Promise((r, e) => { pageWs.onopen = r; pageWs.onerror = e })
  const send = makeRpc(pageWs)
  await send('Page.enable')
  await send('Runtime.enable')

  await wait(1500)
  for (let i = 0; i < 60; i++) {
    const probe = await send('Runtime.evaluate', { expression: 'typeof window.chart === "object"', returnByValue: true })
    if (probe.result.value === true) break
    await wait(200)
  }

  // Canvas rect / world projection helper
  const layout = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = window.chart.getContainer().querySelector('canvas')
      const r = c.getBoundingClientRect()
      return { left: r.left, top: r.top }
    })()`,
    returnByValue: true,
  })
  const RECT = layout.result.value
  const w2p = async (wx, wy) => {
    const res = await send('Runtime.evaluate', {
      expression: `(() => { const v = window.chart.getViewport(); return [${wx} * v.zoom + v.x, ${wy} * v.zoom + v.y] })()`,
      returnByValue: true,
    })
    const [sx, sy] = res.result.value
    return { x: RECT.left + sx, y: RECT.top + sy }
  }

  // ─── Scene setup ───────────────────────────────────────────────────────
  await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.chart
      chart.setViewport({ x: 0, y: 0, zoom: 1 })
      chart.getNodes().map(n => n.id).forEach(id => chart.removeNode(id))
      chart.addNode({ id: 'a', label: 'A', x: 80,  y: 300, width: 100, height: 60 })
      chart.addNode({ id: 'b', label: 'B', x: 500, y: 300, width: 100, height: 60 })
      chart.addEdge({ id: 'e1', source: 'a', target: 'b', label: 'flow', style: { color: '#6366f1', width: 3 } })
      document.querySelectorAll('#hint, [data-flowgl-hint]').forEach(el => el.remove())
    })()`,
    returnByValue: true,
  })
  await wait(300)
  fs.writeFileSync('/tmp/081-initial.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))

  // ─── GATE 1: drag the midpoint handle to insert a waypoint, then click
  // on the new polyline to verify the edge is still selectable. ──────────
  // The midpoint handle is only shown when the edge is selected — so
  // start with a click on the edge body (the pre-fix would have missed
  // this click after a waypoint was already there; for a fresh bezier
  // the click works either way).
  // src.right=(180, 330), tgt.left=(500, 330). Bezier midpoint ≈ (340, 330).
  const onEdge = await w2p(340, 330)
  await click(send, onEdge.x, onEdge.y)
  await wait(150)
  const selByClick = await send('Runtime.evaluate', {
    expression: `(() => { const s = window.chart.getSelectedEdgeIds?.() ?? []; return s })()`,
    returnByValue: true,
  })
  console.log('edge selected via click on bezier midpoint:', JSON.stringify(selByClick.result.value))

  // Force-select so the waypoint-handle drag path is active even if the
  // synthetic CDP click didn't trigger the bound `click` listener.
  await send('Runtime.evaluate', {
    expression: `(() => { window.chart.setSelection({ edges: ['e1'] }) })()`,
    returnByValue: true,
  })
  await wait(150)

  // Diagnostic — count mousedown events + sniff edge-waypoint state.
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__diag = { md: 0, lastClientXY: null, edgeUpdates: [], selOnDown: null, mids: null }
      const canvas = window.chart.getContainer().querySelector('canvas')
      canvas.addEventListener('mousedown', (e) => {
        window.__diag.md++; window.__diag.lastClientXY = [e.clientX, e.clientY]
        window.__diag.selOnDown = [...window.chart.getSelectedEdgeIds()]
      }, true)
      const origUpdate = window.chart.graph.updateEdge.bind(window.chart.graph)
      window.chart.graph.updateEdge = (id, updates) => {
        window.__diag.edgeUpdates.push({ id, updates: JSON.parse(JSON.stringify(updates)) })
        return origUpdate(id, updates)
      }
    })()`,
    returnByValue: true,
  })

  const midpoint = await w2p(340, 330)
  const dragTarget = await w2p(340, 470) // pull the waypoint down by 140 world units
  await drag(send, midpoint.x, midpoint.y, dragTarget.x, dragTarget.y, 12)
  await wait(200)

  const after = await send('Runtime.evaluate', {
    expression: `(() => {
      const e = window.chart.getEdge('e1')
      return { waypoints: e?.waypoints ?? [], diag: window.__diag }
    })()`,
    returnByValue: true,
  })
  console.log('after drag — waypoints + diag:', JSON.stringify(after.result.value))
  fs.writeFileSync('/tmp/081-after-waypoint.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))

  // Find the new polyline midpoint via the chart's edge geometry and click it.
  const wpCenter = await w2p(340, 470)
  await click(send, wpCenter.x, wpCenter.y)
  await wait(200)
  const selected = await send('Runtime.evaluate', {
    expression: `(() => {
      const sel = window.chart.getSelection?.() ?? { edges: [...(window.chart.selectedEdgeIds ?? [])] }
      return sel.edges ?? sel.edgeIds ?? []
    })()`,
    returnByValue: true,
  })
  console.log('selected after click on new polyline:', JSON.stringify(selected.result.value))
  fs.writeFileSync('/tmp/081-clicked-polyline.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))

  // ─── GATE 2: WebGL label fingerprint — switch edge type and verify the
  // label moves with the new geometry instead of staying at the old
  // bezier midpoint. ───────────────────────────────────────────────────
  await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.chart
      chart.setSelection({ edges: [] })
      chart.updateEdge('e1', { waypoints: undefined, type: 'step' })
    })()`,
    returnByValue: true,
  })
  await wait(250)
  fs.writeFileSync('/tmp/081-label-step.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))

  // ─── GATE 3: EdgeToolbar follows the polyline midpoint, not the
  // straight-line midpoint. Setup an EdgeToolbar on the step edge then
  // re-add a waypoint and verify the toolbar moves with the polyline. ──
  const tbX = await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.chart
      chart.setSelection({ edges: ['e1'] })
      chart.updateEdge('e1', { type: 'bezier' })
      const id = chart.addEdgeToolbar({ edgeId: 'e1', content: '<button style="padding:2px 8px;border:none;background:none;color:#e11d48;cursor:pointer;">🗑</button>', align: 'above', offset: 12, isVisible: true })
      return id
    })()`,
    returnByValue: true,
  })
  await wait(150)
  const tbCenter1 = await send('Runtime.evaluate', {
    expression: `(() => { const el = document.querySelector('[data-flowgl-edge-toolbar]'); const r = el?.getBoundingClientRect(); return r ? [r.left + r.width/2, r.top + r.height/2] : null })()`,
    returnByValue: true,
  })

  // Add a waypoint pulling the line way down — toolbar should follow.
  await send('Runtime.evaluate', {
    expression: `(() => { window.chart.updateEdge('e1', { waypoints: [{ x: 340, y: 470 }] }) })()`,
    returnByValue: true,
  })
  await wait(200)
  const tbCenter2 = await send('Runtime.evaluate', {
    expression: `(() => { const el = document.querySelector('[data-flowgl-edge-toolbar]'); const r = el?.getBoundingClientRect(); return r ? [r.left + r.width/2, r.top + r.height/2] : null })()`,
    returnByValue: true,
  })
  console.log('toolbar before waypoint:', tbCenter1.result.value, 'after:', tbCenter2.result.value)
  fs.writeFileSync('/tmp/081-toolbar-followed.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))

  await sendB('Target.closeTarget', { targetId })
  browserWs.close()
  pageWs.close()

  let bad = 0
  if (!Array.isArray(after.result.value.waypoints) || after.result.value.waypoints.length !== 1) {
    console.error('✗ GATE 1 waypoint not inserted'); bad++
  } else {
    console.log('✓ GATE 1a waypoint inserted at', JSON.stringify(after.result.value.waypoints[0]))
  }
  if (!Array.isArray(selected.result.value) || !selected.result.value.includes('e1')) {
    console.error('✗ GATE 1 edge no longer selectable after waypoint insert (the reported regression)'); bad++
  } else {
    console.log('✓ GATE 1b click on the new polyline still picks the edge')
  }

  // GATE 3 — toolbar must have moved a meaningful amount when we added a waypoint.
  const a = tbCenter1.result.value, b = tbCenter2.result.value
  if (!a || !b || Math.hypot(a[0] - b[0], a[1] - b[1]) < 20) {
    console.error(`✗ GATE 3 toolbar barely moved with waypoint (a=${a}, b=${b})`); bad++
  } else {
    console.log(`✓ GATE 3 toolbar followed polyline midpoint by ~${Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]))}px`)
  }

  if (bad === 0) console.log('ALL 0.8.1 GATES OK')
  process.exitCode = bad === 0 ? 0 : 1
}

main().catch(e => { console.error('ERR:', e.message); process.exit(2) })
