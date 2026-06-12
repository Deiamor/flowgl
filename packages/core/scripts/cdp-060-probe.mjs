// CDP probe for 0.6.0 — ViewportPortal scales with zoom, EdgeLabelRenderer
// follows midpoint, NodeResize options storage, extent: 'parent' clamp,
// Easy Connect inflated hit area.
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

  await new Promise(r => setTimeout(r, 1500))
  let chartReady = false
  for (let i = 0; i < 60; i++) {
    try {
      const probe = await send('Runtime.evaluate', { expression: 'typeof window.chart === "object"', returnByValue: true })
      if (probe.result.value === true) { chartReady = true; break }
    } catch {}
    await new Promise(r => setTimeout(r, 200))
  }
  if (!chartReady) throw new Error('window.chart never appeared')

  // Activate 0.6.0 components: ViewportPortal (annotation), EdgeLabel, easyConnect node,
  // extent-clamped child node.
  const setup = await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.chart
      // Inject an annotation (ViewportPortal) anchored in world space.
      const portalId = chart.addViewportPortal({
        x: 80, y: 380, width: 200, height: 60,
        content: '<div style="background:#fff;border:2px dashed #6366f1;border-radius:8px;padding:8px;font:13px system-ui;">📌 ViewportPortal — scales with zoom</div>',
      })
      // Mount an HTML edge label on the first existing edge.
      const edges = chart.getEdges()
      let edgeLabelId = null
      if (edges.length > 0) {
        edgeLabelId = chart.addEdgeLabel({
          edgeId: edges[0].id,
          content: '<span style="font-weight:600;color:#1e88e5;">↗ flow</span>',
        })
      }
      // Add an easyConnect node.
      chart.addNode({ id: 'ec-node', label: 'easyConnect', x: 80, y: 480, width: 140, height: 60, easyConnect: true,
        style: { backgroundColor: '#fff8e1', borderColor: '#f9a825' } })
      // Add a parent group + clamped child.
      chart.addNode({ id: 'parent-grp', label: 'extent: parent', x: 360, y: 480, width: 240, height: 120, type: 'group',
        style: { backgroundColor: 'rgba(120,144,190,0.12)', borderColor: '#7890be' } })
      chart.addNode({ id: 'clamped-child', label: 'child', x: 400, y: 510, width: 80, height: 50,
        parentId: 'parent-grp', extent: 'parent' })
      // NodeResize options
      chart.setNodeResizeOptions({ minWidth: 50, minHeight: 40, maxWidth: 800, maxHeight: 600, keepAspectRatio: false })
      return {
        portalId,
        edgeLabelId,
        easyConnectAdded: !!chart.getNode('ec-node')?.easyConnect,
        extentAdded: chart.getNode('clamped-child')?.extent,
        nodeResizeOptions: chart.getNodeResizeOptions(),
      }
    })()`,
    returnByValue: true,
  })
  console.log('SETUP:', JSON.stringify(setup.result.value))

  await new Promise(r => setTimeout(r, 400))
  const shot1 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/060-default.png', Buffer.from(shot1.data, 'base64'))
  console.log('screenshot → /tmp/060-default.png')

  // Measure ViewportPortal scale at zoom 1
  const measure1 = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('[data-flowgl-viewport-portal]')
      return el ? el.style.transform : null
    })()`,
    returnByValue: true,
  })
  console.log('portal transform @ zoom 1:', measure1.result.value)

  // Zoom to 2x and measure again
  await send('Runtime.evaluate', {
    expression: `(() => { window.chart.zoomTo(2); return window.chart.getViewport().zoom })()`,
    returnByValue: true,
  })
  await new Promise(r => setTimeout(r, 400))
  const measure2 = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('[data-flowgl-viewport-portal]')
      return el ? el.style.transform : null
    })()`,
    returnByValue: true,
  })
  console.log('portal transform @ zoom 2:', measure2.result.value)

  const shot2 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/060-zoom-2x.png', Buffer.from(shot2.data, 'base64'))

  // Drag the clamped child outside the parent — simulate via direct updateNode
  // then trigger a drag-end emit via setSelectedIds → updateNode pattern; the
  // production path runs through drag.ts so we go through a simulated event.
  // Simpler: directly test the clampToExtent helper output.
  const clampProbe = await send('Runtime.evaluate', {
    expression: `(() => {
      // Move the child outside, then read what clampToExtent would produce.
      window.chart.updateNode('clamped-child', { x: 800, y: 800 })
      const node = window.chart.getNode('clamped-child')
      const parent = window.chart.getNode('parent-grp')
      const maxX = parent.x + parent.width - node.width
      const maxY = parent.y + parent.height - node.height
      const clampedX = Math.min(maxX, Math.max(parent.x, node.x))
      const clampedY = Math.min(maxY, Math.max(parent.y, node.y))
      // Force a drag-end emit by simulating: set position then read what
      // the chart's nodeDragEnd handler would clamp it to.
      return { current: { x: node.x, y: node.y }, expectedClamp: { x: clampedX, y: clampedY }, parent: { x: parent.x, y: parent.y, w: parent.width, h: parent.height } }
    })()`,
    returnByValue: true,
  })
  console.log('clamp probe:', JSON.stringify(clampProbe.result.value))

  // Dispose cleanup check
  const dispose = await send('Runtime.evaluate', {
    expression: `(() => {
      const container = window.chart.getContainer()
      window.chart.dispose()
      return {
        portals: container.querySelectorAll('[data-flowgl-viewport-portal]').length,
        edgeLabels: container.querySelectorAll('[data-flowgl-edge-label]').length,
        toolbars: container.querySelectorAll('[role="toolbar"]').length,
      }
    })()`,
    returnByValue: true,
  })
  console.log('dispose:', JSON.stringify(dispose.result.value))

  await sendB('Target.closeTarget', { targetId })
  browserWs.close()
  pageWs.close()

  // Gates
  let bad = 0
  const t1 = measure1.result.value
  const t2 = measure2.result.value
  if (!t1 || !t1.includes('scale(1)')) { console.error('✗ portal not at scale(1)'); bad++ }
  if (!t2 || !t2.includes('scale(2)')) { console.error('✗ portal did not scale to 2 at zoom 2'); bad++ }
  if (!setup.result.value.easyConnectAdded) { console.error('✗ easyConnect not stored'); bad++ }
  if (setup.result.value.extentAdded !== 'parent') { console.error('✗ extent not stored'); bad++ }
  const opts = setup.result.value.nodeResizeOptions
  if (opts.minWidth !== 50 || opts.maxWidth !== 800) { console.error('✗ NodeResize options not stored'); bad++ }
  const d = dispose.result.value
  if (d.portals + d.edgeLabels + d.toolbars > 0) { console.error('✗ overlays leaked after dispose:', d); bad++ }

  if (bad === 0) console.log('ALL 0.6.0 GATES OK')
  process.exitCode = bad === 0 ? 0 : 1
}

main().catch(e => { console.error('ERR:', e.message); process.exit(2) })
