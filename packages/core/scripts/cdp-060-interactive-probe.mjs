// CDP 0.6.0 interactive probe — real mouse events via Input.dispatchMouseEvent.
// Validates: (1) extent: 'parent' clamps the child on a real drag, (2)
// easyConnect node accepts a connection started from its edge area (not on a
// handle), (3) EdgeLabel HTML overlay follows the edge midpoint when the
// viewport is panned.
//
// Exits 0 on all-pass, 1 on any gate failure, 2 on infra error.
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

async function dispatchMouse(send, type, x, y, button = 'left', clickCount = 0) {
  await send('Input.dispatchMouseEvent', {
    type, x, y,
    button,
    buttons: type === 'mouseReleased' ? 0 : (button === 'left' ? 1 : 0),
    clickCount,
  })
}

async function dragGesture(send, fromX, fromY, toX, toY, steps = 8) {
  // Prime hovered state (connect.ts reads pre-computed hoveredHandle in mousedown).
  await dispatchMouse(send, 'mouseMoved', fromX, fromY, 'none')
  await wait(60)
  await dispatchMouse(send, 'mousePressed', fromX, fromY, 'left', 1)
  await wait(40)
  for (let i = 1; i <= steps; i++) {
    const x = fromX + ((toX - fromX) * i) / steps
    const y = fromY + ((toY - fromY) * i) / steps
    await dispatchMouse(send, 'mouseMoved', x, y, 'left')
    await wait(20)
  }
  await wait(40)
  await dispatchMouse(send, 'mouseReleased', toX, toY, 'left', 1)
  await wait(80)
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
  if (!tabWsUrl) throw new Error('tab ws url not resolved')
  const pageWs = new WebSocket(tabWsUrl)
  await new Promise((r, e) => { pageWs.onopen = r; pageWs.onerror = e })
  const send = makeRpc(pageWs)
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Input.setIgnoreInputEvents', { ignore: false })

  await wait(1500)
  let chartReady = false
  for (let i = 0; i < 60; i++) {
    try {
      const probe = await send('Runtime.evaluate', { expression: 'typeof window.chart === "object" && !!window.chart.getContainer', returnByValue: true })
      if (probe.result.value === true) { chartReady = true; break }
    } catch {}
    await wait(200)
  }
  if (!chartReady) throw new Error('window.chart never appeared')

  // Resolve the canvas page-rect so we can translate world coords through.
  const layout = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = window.chart.getContainer().querySelector('canvas')
      const r = el.getBoundingClientRect()
      return { left: r.left, top: r.top, width: r.width, height: r.height }
    })()`,
    returnByValue: true,
  })
  const RECT = layout.result.value
  console.log('canvas rect:', JSON.stringify(RECT))

  const worldToPage = async (wx, wy) => {
    const res = await send('Runtime.evaluate', {
      expression: `(() => { const v = window.chart.getViewport(); return [${wx} * v.zoom + v.x, ${wy} * v.zoom + v.y] })()`,
      returnByValue: true,
    })
    const [sx, sy] = res.result.value
    return { x: RECT.left + sx, y: RECT.top + sy }
  }

  // Set up the scene cleanly: parent group + clamped child, easyConnect node,
  // a regular target node, an edge with an HTML EdgeLabel.
  const setup = await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.chart
      chart.setViewport({ x: 0, y: 0, zoom: 1 })
      // Strip default fixtures so we have full control over coordinates.
      const ids = chart.getNodes().map(n => n.id)
      ids.forEach(id => chart.removeNode(id))
      // Scene
      chart.addNode({ id: 'parent-grp', label: 'extent: parent', x: 80, y: 80, width: 260, height: 140, type: 'group',
        style: { backgroundColor: 'rgba(120,144,190,0.12)', borderColor: '#7890be' } })
      chart.addNode({ id: 'child', label: 'child', x: 110, y: 110, width: 80, height: 50,
        parentId: 'parent-grp', extent: 'parent', draggable: true })
      chart.addNode({ id: 'src-ec', label: 'easyConnect', x: 440, y: 90, width: 140, height: 80, easyConnect: true,
        style: { backgroundColor: '#fff8e1', borderColor: '#f9a825' } })
      chart.addNode({ id: 'dst-ec', label: 'target', x: 440, y: 260, width: 140, height: 60, easyConnect: true,
        style: { backgroundColor: '#e1f5fe', borderColor: '#1e88e5' } })
      // Edge for the label test.
      chart.addNode({ id: 'a', label: 'A', x: 80, y: 400, width: 100, height: 60 })
      chart.addNode({ id: 'b', label: 'B', x: 480, y: 400, width: 100, height: 60 })
      chart.addEdge({ id: 'e1', source: 'a', target: 'b' })
      const labelId = chart.addEdgeLabel({ edgeId: 'e1', content: '<span style="background:#fff;padding:4px 8px;border:1px solid #1e88e5;border-radius:4px;font:600 12px system-ui;color:#1e88e5;">↗ flow</span>' })
      // The demo's #hint overlay sits on top of the canvas and swallows mouse
      // events. Remove it so the probe can drive interactions.
      document.querySelectorAll('#hint, [data-flowgl-hint]').forEach(el => el.remove())
      return { labelId, edgesBefore: chart.getEdges().length }
    })()`,
    returnByValue: true,
  })
  console.log('scene:', JSON.stringify(setup.result.value))

  // Diagnostic — attach event listeners so we can see what the drag pipeline observes.
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__diag = { events: [] }
      window.chart.on('nodeDragStart', (e) => window.__diag.events.push({ t: 'dragStart', id: e?.node?.id ?? e?.id }))
      window.chart.on('nodeDrag', (e) => { if (window.__diag.events.length < 200) window.__diag.events.push({ t: 'drag', id: e?.node?.id ?? e?.id, x: e?.node?.x, y: e?.node?.y }) })
      window.chart.on('nodeDragEnd', (e) => window.__diag.events.push({ t: 'dragEnd', id: e?.node?.id ?? e?.id, x: e?.node?.x, y: e?.node?.y }))
      window.chart.on('connect', (e) => window.__diag.events.push({ t: 'connect', src: e?.source, dst: e?.target }))
      window.chart.on('nodeClick', (e) => window.__diag.events.push({ t: 'nodeClick', id: e?.node?.id ?? e?.id }))
    })()`,
    returnByValue: true,
  })

  await wait(400)
  const shotInit = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/060i-initial.png', Buffer.from(shotInit.data, 'base64'))

  // ─── GATE 1: extent: 'parent' clamps child on real drag ─────────────
  // Drag the child far to the right/down past the parent's bottom-right
  // corner. After release, the child should sit clamped at the corner,
  // not at the drop point.
  const childCenter = await worldToPage(110 + 40, 110 + 25)
  const dropPage = await worldToPage(900, 900) // way outside parent
  console.log('child drag:', childCenter, '→', dropPage)
  await dragGesture(send, childCenter.x, childCenter.y, dropPage.x, dropPage.y, 10)
  const afterClamp = await send('Runtime.evaluate', {
    expression: `(() => { const n = window.chart.getNode('child'); const p = window.chart.getNode('parent-grp'); return { child: { x: n.x, y: n.y, w: n.width, h: n.height }, parent: { x: p.x, y: p.y, w: p.width, h: p.height } } })()`,
    returnByValue: true,
  })
  const ac = afterClamp.result.value
  console.log('after drag:', JSON.stringify(ac))
  const diag1 = await send('Runtime.evaluate', {
    expression: '(() => { const evts = window.__diag.events.slice(); window.__diag.events = []; return evts })()',
    returnByValue: true,
  })
  console.log('drag-1 events:', JSON.stringify(diag1.result.value).slice(0, 400))
  // Expected: child.x ≤ parent.x + parent.w - child.w, child.y ≤ parent.y + parent.h - child.h
  // AND ≥ parent.x / parent.y.
  const clampX = ac.parent.x + ac.parent.w - ac.child.w
  const clampY = ac.parent.y + ac.parent.h - ac.child.h
  const extentOk =
    ac.child.x >= ac.parent.x && ac.child.x <= clampX + 0.5 &&
    ac.child.y >= ac.parent.y && ac.child.y <= clampY + 0.5 &&
    Math.abs(ac.child.x - clampX) <= 2 && Math.abs(ac.child.y - clampY) <= 2

  const shot1 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/060i-extent-clamp.png', Buffer.from(shot1.data, 'base64'))

  // ─── GATE 2: easyConnect — drag from the edge of the source node into
  // the target. With easyConnect=true the hit radius is min(w,h)/4 ≈ 20px,
  // so a press 10px outside the rendered handle should still start a
  // connection.
  const beforeEdges = await send('Runtime.evaluate', { expression: 'window.chart.getEdges().length', returnByValue: true })
  // Source bottom-center area — pick a point slightly below the bottom edge.
  const srcEdge = await worldToPage(440 + 70, 90 + 80 + 6) // ~6px below bottom edge
  const dstCenter = await worldToPage(440 + 70, 260 + 30)
  console.log('easy-connect drag:', srcEdge, '→', dstCenter)
  await dragGesture(send, srcEdge.x, srcEdge.y, dstCenter.x, dstCenter.y, 14)
  const afterEdges = await send('Runtime.evaluate', {
    expression: `(() => { const es = window.chart.getEdges(); const newOnes = es.filter(e => (e.source==='src-ec' && e.target==='dst-ec') || (e.source==='dst-ec' && e.target==='src-ec')); return { total: es.length, newCount: newOnes.length, ids: newOnes.map(e=>e.id) } })()`,
    returnByValue: true,
  })
  console.log('edges after easy-connect:', JSON.stringify(afterEdges.result.value))
  const diag2 = await send('Runtime.evaluate', {
    expression: '(() => { const evts = window.__diag.events.slice(); window.__diag.events = []; return evts })()',
    returnByValue: true,
  })
  console.log('drag-2 events:', JSON.stringify(diag2.result.value).slice(0, 400))
  const ecOk = afterEdges.result.value.newCount >= 1

  const shot2 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/060i-easy-connect.png', Buffer.from(shot2.data, 'base64'))

  // ─── GATE 3: EdgeLabel follows the midpoint when viewport pans ──────
  // Read the label's screen position before and after a pan, and verify
  // the delta matches the pan delta.
  const labelEl = `[data-flowgl-edge-label]`
  const before = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('${labelEl}')
      const r = el.getBoundingClientRect()
      return { cx: r.left + r.width/2, cy: r.top + r.height/2, visible: el.getAttribute('data-visible') }
    })()`,
    returnByValue: true,
  })
  // Pan +120 right, +60 down (in screen-space — setViewport translates world).
  await send('Runtime.evaluate', {
    expression: `(() => { const v = window.chart.getViewport(); window.chart.setViewport({ x: v.x + 120, y: v.y + 60, zoom: v.zoom }) })()`,
    returnByValue: true,
  })
  await wait(200)
  const after = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('${labelEl}')
      const r = el.getBoundingClientRect()
      return { cx: r.left + r.width/2, cy: r.top + r.height/2, visible: el.getAttribute('data-visible') }
    })()`,
    returnByValue: true,
  })
  const b = before.result.value
  const a = after.result.value
  const dx = a.cx - b.cx
  const dy = a.cy - b.cy
  console.log('label pan:', JSON.stringify({ before: b, after: a, delta: { dx, dy } }))
  const labelOk = a.visible === 'true' && Math.abs(dx - 120) <= 3 && Math.abs(dy - 60) <= 3

  const shot3 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/060i-edge-label-pan.png', Buffer.from(shot3.data, 'base64'))

  await sendB('Target.closeTarget', { targetId })
  browserWs.close()
  pageWs.close()

  let bad = 0
  if (!extentOk) { console.error(`✗ GATE 1 extent clamp: expected (${ac.parent.x + ac.parent.w - ac.child.w}, ${ac.parent.y + ac.parent.h - ac.child.h}), got (${ac.child.x}, ${ac.child.y})`); bad++ }
  else console.log('✓ GATE 1 extent: child clamped to parent corner')
  if (!ecOk) { console.error('✗ GATE 2 easyConnect: no edge created from near-edge drag'); bad++ }
  else console.log('✓ GATE 2 easyConnect: connection created from near-edge press')
  if (!labelOk) { console.error(`✗ GATE 3 edge-label pan: delta (${dx}, ${dy}) ≠ pan (120, 60)`); bad++ }
  else console.log('✓ GATE 3 edge-label: midpoint follows viewport pan')

  if (bad === 0) console.log('ALL 0.6.0 INTERACTIVE GATES OK')
  process.exitCode = bad === 0 ? 0 : 1
}

main().catch(e => { console.error('ERR:', e.message); process.exit(2) })
