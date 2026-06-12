// CDP 0.9.0 probe — NodeTypeRegistry custom node-type round-trip.
//
// Gates:
//   GATE 1 — registerNodeType + addNode mounts a <div> with the registered
//            render output and correct data-* attributes.
//   GATE 2 — the div transform tracks viewport pan + zoom (renders the
//            scale(N) the layer is supposed to emit).
//   GATE 3 — built-in shape names cannot be re-registered (throws).
//   GATE 4 — removeNode tears down the div and fires the destroy hook.
//   GATE 5 — dispose drains the html-node root layer entirely.
//
// Exit 0 = pass, 1 = any gate fails, 2 = infra error.

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
  const pageWs = new WebSocket(tabWsUrl)
  await new Promise((r, e) => { pageWs.onopen = r; pageWs.onerror = e })
  const send = makeRpc(pageWs)
  await send('Page.enable')
  await send('Runtime.enable')

  await wait(1500)
  for (let i = 0; i < 60; i++) {
    const probe = await send('Runtime.evaluate', { expression: 'typeof window.chart === "object" && !!window.chart.registerNodeType', returnByValue: true })
    if (probe.result.value === true) break
    await wait(200)
  }

  // ─── Scene + register a custom type ─────────────────────────────────
  const setup = await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.chart
      chart.setViewport({ x: 0, y: 0, zoom: 1 })
      chart.getNodes().map(n => n.id).forEach(id => chart.removeNode(id))
      window.__destroyed = []
      chart.registerNodeType('uml-class', {
        category: 'html',
        defaultSize: { width: 200, height: 120 },
        render: (el, node) => {
          el.innerHTML =
            '<div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:10px;height:100%;box-sizing:border-box;font:13px system-ui;">' +
              '<div style="font-weight:700;border-bottom:1px solid #f59e0b;padding-bottom:4px;margin-bottom:4px;">' + node.label + '</div>' +
              '<div style="opacity:.7;font-size:11px;">' + (node.data?.kind ?? 'class') + '</div>' +
              '<ul style="margin:6px 0 0;padding-left:14px;font-size:11px;">' +
                ((node.data?.methods) ?? ['+ create()', '+ save()']).map(m => '<li>' + m + '</li>').join('') +
              '</ul>' +
            '</div>'
        },
        destroy: (_el, n) => window.__destroyed.push(n.id),
      })
      chart.addNode({ id: 'cls-order', label: 'Order', x: 100, y: 100, width: 220, height: 140, type: 'uml-class', data: { kind: 'aggregate', methods: ['+ place()', '+ cancel()', '+ pay()'] } })
      chart.addNode({ id: 'cls-product', label: 'Product', x: 420, y: 100, width: 220, height: 140, type: 'uml-class' })
      // A built-in for comparison
      chart.addNode({ id: 'rect-info', label: 'note', x: 100, y: 320, width: 200, height: 60, type: 'rectangle' })
      // Try to re-register a built-in (must throw)
      let reservedThrew = false
      try { chart.registerNodeType('rectangle', { category: 'html', render: () => {} }) } catch { reservedThrew = true }
      document.querySelectorAll('#hint, [data-flowgl-hint]').forEach(el => el.remove())
      return {
        registered: chart.getRegisteredNodeTypes().sort(),
        custom: chart.getCustomNodeTypes(),
        reservedThrew,
        htmlNodeCount: document.querySelectorAll('[data-flowgl-html-node]').length,
        builtinHtml: !!document.querySelector('[data-flowgl-html-node="rect-info"]'),
      }
    })()`,
    returnByValue: true,
  })
  console.log('setup:', JSON.stringify(setup.result.value))

  await wait(400)
  fs.writeFileSync('/tmp/090-initial.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))

  // ─── GATE 2: zoom — transform must include scale(N) ──────────────────
  await send('Runtime.evaluate', {
    expression: `window.chart.zoomTo(1.5)`, returnByValue: true,
  })
  await wait(250)
  const zoomCheck = await send('Runtime.evaluate', {
    expression: `(() => { const el = document.querySelector('[data-flowgl-html-node="cls-order"]'); return el ? el.style.transform : null })()`,
    returnByValue: true,
  })
  console.log('after zoom 1.5:', zoomCheck.result.value)
  fs.writeFileSync('/tmp/090-zoom.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))

  // ─── GATE 4: removeNode unmounts + destroy ───────────────────────────
  await send('Runtime.evaluate', {
    expression: `window.chart.setViewport({ x: 0, y: 0, zoom: 1 }); window.chart.removeNode('cls-product')`,
    returnByValue: true,
  })
  await wait(200)
  const removeCheck = await send('Runtime.evaluate', {
    expression: `(() => ({
      stillThere: !!document.querySelector('[data-flowgl-html-node="cls-product"]'),
      destroyedIds: window.__destroyed,
      remaining: document.querySelectorAll('[data-flowgl-html-node]').length,
    }))()`,
    returnByValue: true,
  })
  console.log('after remove:', JSON.stringify(removeCheck.result.value))

  // ─── GATE 5: dispose ─────────────────────────────────────────────────
  const dispose = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = window.chart.getContainer()
      window.chart.dispose()
      return {
        nodes: c.querySelectorAll('[data-flowgl-html-node]').length,
        roots: c.querySelectorAll('[data-flowgl-html-node-root]').length,
      }
    })()`,
    returnByValue: true,
  })
  console.log('dispose:', JSON.stringify(dispose.result.value))

  await sendB('Target.closeTarget', { targetId })
  browserWs.close()
  pageWs.close()

  let bad = 0
  const s = setup.result.value
  if (!s.registered.includes('uml-class')) { console.error('✗ GATE 1 custom type not in registry'); bad++ }
  if (s.htmlNodeCount !== 2) { console.error(`✗ GATE 1 expected 2 html nodes, got ${s.htmlNodeCount}`); bad++ }
  if (s.builtinHtml) { console.error('✗ GATE 1 built-in rectangle wrongly mounted as html'); bad++ }
  if (bad === 0) console.log('✓ GATE 1 register + mount + built-in not in html layer')

  if (!zoomCheck.result.value || !/scale\(1\.5\)/.test(zoomCheck.result.value)) {
    console.error(`✗ GATE 2 zoom transform missing scale(1.5): ${zoomCheck.result.value}`); bad++
  } else console.log('✓ GATE 2 transform includes scale(1.5) after zoom')

  if (!s.reservedThrew) { console.error('✗ GATE 3 reserved name was registrable'); bad++ }
  else console.log('✓ GATE 3 reserved built-in name rejected')

  const r = removeCheck.result.value
  if (r.stillThere) { console.error('✗ GATE 4 div not unmounted on removeNode'); bad++ }
  else if (!r.destroyedIds.includes('cls-product')) { console.error('✗ GATE 4 destroy hook not called'); bad++ }
  else console.log('✓ GATE 4 removeNode unmounted + destroy fired')

  const d = dispose.result.value
  if (d.nodes + d.roots !== 0) { console.error(`✗ GATE 5 leak after dispose: ${JSON.stringify(d)}`); bad++ }
  else console.log('✓ GATE 5 dispose drains html-node root + every div')

  if (bad === 0) console.log('ALL 0.9.0 GATES OK')
  process.exitCode = bad === 0 ? 0 : 1
}

main().catch(e => { console.error('ERR:', e.message); process.exit(2) })
