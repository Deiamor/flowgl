// CDP 0.8.0 interactive probe — Computing Flows + expandParent + Helper Lines
// + Proximity Connect, all driven through real mouse events / API calls.
//
// Gates:
//   GATE 1 — Computing Flows: a→b→c chain propagates; cycle detection
//            fires nodeDataCycle without entering an infinite loop.
//   GATE 2 — expandParent: drag the child past the parent's right edge,
//            parent expands to contain it (instead of clamping).
//   GATE 3 — Helper Lines: drag node A near node B; pink guides appear,
//            drop position snaps to B's coordinate.
//   GATE 4 — Proximity Connect: drag node A near node B; ghost + halo
//            appear; on drop a new edge connects A→B.
//
// Exits 0 on pass, 1 on any failure, 2 on infra error.

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

async function dragGesture(send, fromX, fromY, toX, toY, steps = 10) {
  await dispatchMouse(send, 'mouseMoved', fromX, fromY, 'none')
  await wait(40)
  await dispatchMouse(send, 'mousePressed', fromX, fromY, 'left', 1)
  await wait(40)
  for (let i = 1; i <= steps; i++) {
    const x = fromX + ((toX - fromX) * i) / steps
    const y = fromY + ((toY - fromY) * i) / steps
    await dispatchMouse(send, 'mouseMoved', x, y, 'left')
    await wait(20)
  }
  await wait(50)
  await dispatchMouse(send, 'mouseReleased', toX, toY, 'left', 1)
  await wait(120)
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

  await wait(1500)
  let ready = false
  for (let i = 0; i < 60; i++) {
    try {
      const probe = await send('Runtime.evaluate', { expression: 'typeof window.chart === "object" && !!window.chart.updateNodeData && !!window.chart.setHelperLinesOptions', returnByValue: true })
      if (probe.result.value === true) { ready = true; break }
    } catch {}
    await wait(200)
  }
  if (!ready) throw new Error('window.chart 0.8.0 APIs not exported')

  // Canvas rect
  const layout = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = window.chart.getContainer().querySelector('canvas')
      const r = c.getBoundingClientRect()
      return { left: r.left, top: r.top }
    })()`,
    returnByValue: true,
  })
  const RECT = layout.result.value

  const worldToPage = async (wx, wy) => {
    const res = await send('Runtime.evaluate', {
      expression: `(() => { const v = window.chart.getViewport(); return [${wx} * v.zoom + v.x, ${wy} * v.zoom + v.y] })()`,
      returnByValue: true,
    })
    const [sx, sy] = res.result.value
    return { x: RECT.left + sx, y: RECT.top + sy }
  }

  // ─── GATE 1: Computing Flows ──────────────────────────────────────────
  const cf = await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.chart
      chart.setViewport({ x: 0, y: 0, zoom: 1 })
      chart.getNodes().map(n => n.id).forEach(id => chart.removeNode(id))
      chart.addNode({ id: 'a', label: 'A', x: 80,  y: 80,  width: 80, height: 50, data: { value: 1 } })
      chart.addNode({ id: 'b', label: 'B', x: 240, y: 80,  width: 80, height: 50, data: { value: 0 } })
      chart.addNode({ id: 'c', label: 'C', x: 400, y: 80,  width: 80, height: 50, data: { value: 0 } })

      const cycles = []
      chart.on('nodeDataCycle', (e) => cycles.push(e))

      // Chain: a → b (×10), b → c (+1)
      chart.subscribeNodeData('a', (data) => chart.updateNodeData('b', { value: data.value * 10 }))
      chart.subscribeNodeData('b', (data) => chart.updateNodeData('c', { value: data.value + 1 }))
      chart.updateNodeData('a', { value: 7 })
      const chain = {
        a: chart.getNode('a').data.value,
        b: chart.getNode('b').data.value,
        c: chart.getNode('c').data.value,
      }

      // Cycle: install a→b→a writer; expect veto, no stack overflow
      const ux = chart.subscribeNodeData('b', (data) => chart.updateNodeData('a', { feedback: data.value }))
      chart.updateNodeData('a', { value: 9 })
      const cycleCount = cycles.length
      ux()
      return { chain, cycleCount, cycleChain: cycles[0]?.chain ?? null, finalA: chart.getNode('a').data }
    })()`,
    returnByValue: true,
  })
  console.log('CF:', JSON.stringify(cf.result.value))

  // Clean up so subsequent gates have a fresh scene.
  await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.chart
      chart.getNodes().map(n => n.id).forEach(id => chart.removeNode(id))
    })()`,
    returnByValue: true,
  })
  await send('Runtime.evaluate', {
    expression: `document.querySelectorAll('#hint, [data-flowgl-hint]').forEach(el => el.remove())`,
    returnByValue: true,
  })

  // ─── GATE 2: expandParent ─────────────────────────────────────────────
  await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.chart
      chart.addNode({ id: 'p', label: 'parent', x: 80, y: 80, width: 240, height: 140, type: 'group', style: { backgroundColor: 'rgba(120,144,190,0.12)', borderColor: '#7890be' } })
      chart.addNode({ id: 'c', label: 'child', x: 120, y: 110, width: 80, height: 50, parentId: 'p', expandParent: true })
    })()`,
    returnByValue: true,
  })

  const childCenter = await worldToPage(120 + 40, 110 + 25)
  const dropOutside = await worldToPage(500, 400)  // far past parent's right/bottom
  console.log('expandParent drag:', childCenter, '→', dropOutside)
  await dragGesture(send, childCenter.x, childCenter.y, dropOutside.x, dropOutside.y, 10)
  await wait(200)
  const ep = await send('Runtime.evaluate', {
    expression: `(() => {
      const p = window.chart.getNode('p'); const c = window.chart.getNode('c')
      return { parent: { x: p.x, y: p.y, w: p.width, h: p.height }, child: { x: c.x, y: c.y } }
    })()`,
    returnByValue: true,
  })
  console.log('expandParent:', JSON.stringify(ep.result.value))
  const shot2 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/080-expand-parent.png', Buffer.from(shot2.data, 'base64'))

  // ─── GATE 3: Helper Lines ─────────────────────────────────────────────
  await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.chart
      chart.getNodes().map(n => n.id).forEach(id => chart.removeNode(id))
      chart.setHelperLinesOptions({ enabled: true, snap: 6, show: 28 })
      chart.addNode({ id: 'fixed', label: 'fixed', x: 400, y: 200, width: 100, height: 60, style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b' } })
      chart.addNode({ id: 'moving', label: 'moving', x: 100, y: 100, width: 100, height: 60, style: { backgroundColor: '#dbeafe', borderColor: '#2563eb' } })
    })()`,
    returnByValue: true,
  })
  // Drag moving so its left edge lands at x = ~395 (3 px off 400) — should snap to 400.
  const movingCenter = await worldToPage(100 + 50, 100 + 30)
  const dropNearMatch = await worldToPage(395 + 50, 100 + 30)
  await dragGesture(send, movingCenter.x, movingCenter.y, dropNearMatch.x, dropNearMatch.y, 14)
  await wait(150)
  const hl = await send('Runtime.evaluate', {
    expression: `(() => {
      const m = window.chart.getNode('moving')
      const lines = Array.from(document.querySelectorAll('.flowgl-helper-line')).length
      return { x: m.x, y: m.y, lines }
    })()`,
    returnByValue: true,
  })
  console.log('helperLines:', JSON.stringify(hl.result.value))
  // Move slightly so a guide is visible for the screenshot, then re-drop snapped
  await send('Runtime.evaluate', {
    expression: `(() => { window.chart.updateNode('moving', { x: 100, y: 100 }) })()`,
    returnByValue: true,
  })
  const m2 = await worldToPage(100 + 50, 100 + 30)
  const guidePos = await worldToPage(393 + 50, 100 + 30)
  // Press, move close to match, but DON'T release yet — screenshot guide visible
  await dispatchMouse(send, 'mouseMoved', m2.x, m2.y, 'none')
  await wait(40)
  await dispatchMouse(send, 'mousePressed', m2.x, m2.y, 'left', 1)
  await wait(40)
  for (let i = 1; i <= 8; i++) {
    const x = m2.x + ((guidePos.x - m2.x) * i) / 8
    const y = m2.y + ((guidePos.y - m2.y) * i) / 8
    await dispatchMouse(send, 'mouseMoved', x, y, 'left')
    await wait(20)
  }
  await wait(150)
  const shot3 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/080-helper-lines.png', Buffer.from(shot3.data, 'base64'))
  await dispatchMouse(send, 'mouseReleased', guidePos.x, guidePos.y, 'left', 1)
  await wait(120)

  // ─── GATE 4: Proximity Connect ────────────────────────────────────────
  await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.chart
      chart.getNodes().map(n => n.id).forEach(id => chart.removeNode(id))
      chart.setHelperLinesOptions({ enabled: false })
      chart.setProximityConnectOptions({ enabled: true, threshold: 70 })
      chart.addNode({ id: 'src', label: 'src', x: 100, y: 100, width: 100, height: 60, style: { backgroundColor: '#ddd6fe', borderColor: '#7c3aed' } })
      chart.addNode({ id: 'tgt', label: 'tgt', x: 400, y: 100, width: 100, height: 60, style: { backgroundColor: '#a7f3d0', borderColor: '#10b981' } })
    })()`,
    returnByValue: true,
  })
  // Drag src toward tgt — stop ~40 px short of tgt's left edge (gap=40 < threshold=70)
  const srcCenter = await worldToPage(100 + 50, 100 + 30)
  const dropNearTgt = await worldToPage(250 + 50, 100 + 30) // src ends at x=350, tgt.x=400, gap=50
  await dispatchMouse(send, 'mouseMoved', srcCenter.x, srcCenter.y, 'none')
  await wait(40)
  await dispatchMouse(send, 'mousePressed', srcCenter.x, srcCenter.y, 'left', 1)
  await wait(40)
  for (let i = 1; i <= 12; i++) {
    const x = srcCenter.x + ((dropNearTgt.x - srcCenter.x) * i) / 12
    const y = srcCenter.y + ((dropNearTgt.y - srcCenter.y) * i) / 12
    await dispatchMouse(send, 'mouseMoved', x, y, 'left')
    await wait(20)
  }
  await wait(120)
  const proxBefore = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        ghost: document.querySelectorAll('[data-flowgl-proximity-ghost]').length,
        halo:  document.querySelectorAll('[data-flowgl-proximity-halo]').length,
      }
    })()`,
    returnByValue: true,
  })
  const shot4 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/080-proximity-ghost.png', Buffer.from(shot4.data, 'base64'))
  await dispatchMouse(send, 'mouseReleased', dropNearTgt.x, dropNearTgt.y, 'left', 1)
  await wait(180)
  const proxAfter = await send('Runtime.evaluate', {
    expression: `(() => {
      const edges = window.chart.getEdges()
      return {
        edgeCount: edges.length,
        srcToTgt: edges.find(e => e.source === 'src' && e.target === 'tgt') ?? null,
        ghost: document.querySelectorAll('[data-flowgl-proximity-ghost]').length,
        halo:  document.querySelectorAll('[data-flowgl-proximity-halo]').length,
      }
    })()`,
    returnByValue: true,
  })
  console.log('proxBefore drop:', JSON.stringify(proxBefore.result.value))
  console.log('proxAfter drop:',  JSON.stringify(proxAfter.result.value))
  const shot5 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/080-proximity-edge.png', Buffer.from(shot5.data, 'base64'))

  await sendB('Target.closeTarget', { targetId })
  browserWs.close()
  pageWs.close()

  let bad = 0
  // GATE 1 — CF
  const c1 = cf.result.value
  if (!c1.chain || c1.chain.a !== 7 || c1.chain.b !== 70 || c1.chain.c !== 71) {
    console.error(`✗ GATE 1 CF chain unexpected: ${JSON.stringify(c1.chain)}`); bad++
  }
  if (c1.cycleCount < 1) { console.error('✗ GATE 1 CF cycle not detected'); bad++ }
  if (!c1.cycleChain || c1.cycleChain[0] !== 'a' || c1.cycleChain[c1.cycleChain.length - 1] !== 'a') {
    console.error(`✗ GATE 1 CF cycle chain malformed: ${JSON.stringify(c1.cycleChain)}`); bad++
  }
  if (bad === 0) console.log('✓ GATE 1 Computing Flows — chain + cycle detection')

  // GATE 2 — expandParent
  const e = ep.result.value
  const childContainedAfter = e.child.x >= e.parent.x && e.child.x + 80 <= e.parent.x + e.parent.w
  const parentGrew = e.parent.w > 240 || e.parent.h > 140
  if (!childContainedAfter || !parentGrew) {
    console.error(`✗ GATE 2 expandParent failed: parent=${JSON.stringify(e.parent)}, child=${JSON.stringify(e.child)}`); bad++
  } else console.log('✓ GATE 2 expandParent — parent grew to contain child')

  // GATE 3 — Helper Lines
  const h = hl.result.value
  if (h.x !== 400) { console.error(`✗ GATE 3 Helper Lines snap missed: x=${h.x} (expected 400)`); bad++ }
  else console.log('✓ GATE 3 Helper Lines — drag snapped left edge to neighbour at x=400')

  // GATE 4 — Proximity Connect
  if (proxBefore.result.value.ghost < 1 || proxBefore.result.value.halo < 1) {
    console.error(`✗ GATE 4 proximity ghost/halo missing during drag: ${JSON.stringify(proxBefore.result.value)}`); bad++
  }
  if (!proxAfter.result.value.srcToTgt) { console.error('✗ GATE 4 proximity edge not created on drop'); bad++ }
  else if (proxAfter.result.value.ghost !== 0 || proxAfter.result.value.halo !== 0) {
    console.error(`✗ GATE 4 proximity visuals not cleared after drop: ${JSON.stringify(proxAfter.result.value)}`); bad++
  } else console.log('✓ GATE 4 Proximity Connect — ghost + halo during drag, edge created on drop')

  if (bad === 0) console.log('ALL 0.8.0 GATES OK')
  process.exitCode = bad === 0 ? 0 : 1
}

main().catch(e => { console.error('ERR:', e.message); process.exit(2) })
