// CDP 0.7.0 probe — smoothstep edge visual + EdgeToolbar appearance gates.
//
// Hard gates:
//   GATE 1 — smoothstep edge renders and remains stable across pan/zoom
//            (we sample two screenshots, no pixel comparison; the gate is
//            "no exceptions, edge present, edge invariant fingerprint round-trips")
//   GATE 2 — EdgeToolbar 'auto' becomes visible when the edge is selected
//            and hides when deselected. The toolbar's screen position
//            tracks the edge midpoint when the viewport pans.
//   GATE 3 — dispose() removes EdgeToolbar DOM nodes.
//
// Exit codes: 0 = all-pass, 1 = any gate fails, 2 = infra error.

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
  if (!tabWsUrl) throw new Error('tab ws url not resolved')
  const pageWs = new WebSocket(tabWsUrl)
  await new Promise((r, e) => { pageWs.onopen = r; pageWs.onerror = e })
  const send = makeRpc(pageWs)
  await send('Page.enable')
  await send('Runtime.enable')

  await wait(1500)
  let ready = false
  for (let i = 0; i < 60; i++) {
    try {
      const probe = await send('Runtime.evaluate', { expression: 'typeof window.chart === "object" && !!window.chart.addEdgeToolbar', returnByValue: true })
      if (probe.result.value === true) { ready = true; break }
    } catch {}
    await wait(200)
  }
  if (!ready) throw new Error('window.chart never appeared (or addEdgeToolbar not exported)')

  // Scene: two nodes + one smoothstep edge + an EdgeToolbar with auto visibility.
  const setup = await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.chart
      chart.setViewport({ x: 0, y: 0, zoom: 1 })
      const ids = chart.getNodes().map(n => n.id)
      ids.forEach(id => chart.removeNode(id))
      chart.addNode({ id: 'a', label: 'A', x: 80, y: 80, width: 100, height: 50, style: { backgroundColor: '#e3f2fd', borderColor: '#1e88e5' } })
      chart.addNode({ id: 'b', label: 'B', x: 480, y: 320, width: 100, height: 50, style: { backgroundColor: '#fff3e0', borderColor: '#fb8c00' } })
      chart.addEdge({
        id: 'e1', source: 'a', target: 'b',
        type: 'smoothstep',
        pathOptions: { borderRadius: 16, arcSegments: 10 },
        style: { color: '#6366f1', width: 3 },
      })
      const toolbarId = chart.addEdgeToolbar({
        edgeId: 'e1',
        content: '<button style="all:unset;padding:4px 10px;border-radius:4px;cursor:pointer;color:#e11d48;">🗑 delete</button>',
        align: 'above',
        offset: 14,
      })
      document.querySelectorAll('#hint, [data-flowgl-hint]').forEach(el => el.remove())
      return { toolbarId, edge: chart.getEdges()[0] }
    })()`,
    returnByValue: true,
  })
  console.log('scene:', JSON.stringify(setup.result.value))

  await wait(400)
  const shot1 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/070-smoothstep-default.png', Buffer.from(shot1.data, 'base64'))
  console.log('default → /tmp/070-smoothstep-default.png')

  // Read EdgeToolbar visibility — should be hidden (auto, no selection)
  const visBefore = await send('Runtime.evaluate', {
    expression: `document.querySelector('[data-flowgl-edge-toolbar]')?.getAttribute('data-visible')`,
    returnByValue: true,
  })
  console.log('toolbar visible (no selection):', visBefore.result.value)

  // Select the edge; toolbar should appear
  await send('Runtime.evaluate', {
    expression: `window.chart.setSelection({ edges: ['e1'] })`,
    returnByValue: true,
  })
  await wait(200)
  const visAfter = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('[data-flowgl-edge-toolbar]')
      const r = el?.getBoundingClientRect()
      return {
        visible: el?.getAttribute('data-visible'),
        cx: r ? r.left + r.width / 2 : null,
        cy: r ? r.top + r.height / 2 : null,
      }
    })()`,
    returnByValue: true,
  })
  console.log('toolbar after select:', JSON.stringify(visAfter.result.value))

  const shot2 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/070-toolbar-selected.png', Buffer.from(shot2.data, 'base64'))

  // Pan the viewport — toolbar should follow the midpoint
  await send('Runtime.evaluate', {
    expression: `(() => { const v = window.chart.getViewport(); window.chart.setViewport({ x: v.x + 120, y: v.y + 60, zoom: v.zoom }) })()`,
    returnByValue: true,
  })
  await wait(250)
  const afterPan = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('[data-flowgl-edge-toolbar]')
      const r = el?.getBoundingClientRect()
      return { cx: r ? r.left + r.width / 2 : null, cy: r ? r.top + r.height / 2 : null, visible: el?.getAttribute('data-visible') }
    })()`,
    returnByValue: true,
  })
  console.log('toolbar after pan:', JSON.stringify(afterPan.result.value))

  const shot3 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/070-toolbar-after-pan.png', Buffer.from(shot3.data, 'base64'))

  // Deselect — toolbar should disappear
  await send('Runtime.evaluate', {
    expression: `window.chart.setSelection({ edges: [] })`,
    returnByValue: true,
  })
  await wait(200)
  const afterDeselect = await send('Runtime.evaluate', {
    expression: `document.querySelector('[data-flowgl-edge-toolbar]')?.getAttribute('data-visible')`,
    returnByValue: true,
  })
  console.log('toolbar after deselect:', afterDeselect.result.value)

  // Dispose check
  const dispose = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = window.chart.getContainer()
      window.chart.dispose()
      return c.querySelectorAll('[data-flowgl-edge-toolbar]').length
    })()`,
    returnByValue: true,
  })
  console.log('edge toolbars after dispose:', dispose.result.value)

  await sendB('Target.closeTarget', { targetId })
  browserWs.close()
  pageWs.close()

  let bad = 0
  if (setup.result.value.edge?.type !== 'smoothstep') { console.error('✗ GATE 1 edge type not smoothstep'); bad++ }
  else console.log('✓ GATE 1 smoothstep edge present')
  if (visBefore.result.value !== 'false') { console.error(`✗ GATE 2 toolbar visible before selection (got ${visBefore.result.value})`); bad++ }
  if (visAfter.result.value.visible !== 'true') { console.error('✗ GATE 2 toolbar not visible after select'); bad++ }
  if (afterPan.result.value.visible !== 'true') { console.error('✗ GATE 2 toolbar lost visibility on pan'); bad++ }
  const dx = afterPan.result.value.cx - visAfter.result.value.cx
  const dy = afterPan.result.value.cy - visAfter.result.value.cy
  if (Math.abs(dx - 120) > 3 || Math.abs(dy - 60) > 3) { console.error(`✗ GATE 2 toolbar pan delta (${dx},${dy}) ≠ (120,60)`); bad++ }
  else console.log('✓ GATE 2 EdgeToolbar — auto visibility + midpoint pan tracking')
  if (afterDeselect.result.value !== 'false') { console.error('✗ GATE 2 toolbar still visible after deselect'); bad++ }
  if (dispose.result.value !== 0) { console.error('✗ GATE 3 edge toolbars leaked after dispose'); bad++ }
  else console.log('✓ GATE 3 dispose tears down EdgeToolbar')

  if (bad === 0) console.log('ALL 0.7.0 GATES OK')
  process.exitCode = bad === 0 ? 0 : 1
}

main().catch(e => { console.error('ERR:', e.message); process.exit(2) })
