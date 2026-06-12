---
title: Benchmarks
---

# Benchmarks

Live time-series of fps measurements from
[`scripts/run-benchmark.mjs`](https://github.com/Deiamor/flowgl/blob/master/scripts/run-benchmark.mjs)
driven by the
[`Benchmark` workflow](https://github.com/Deiamor/flowgl/actions/workflows/benchmark.yml)
on every push to `packages/core/src/**` plus a weekly Sunday cron.

The runner is **headless Chromium with SwiftShader** — the same baseline
that produces the numbers in
[PERFORMANCE.md](https://github.com/Deiamor/flowgl/blob/master/packages/core/PERFORMANCE.md).
Real-GPU runners outperform these numbers; we publish SwiftShader so the
floor we promise (T6 in
[PRODUCT.md](https://github.com/Deiamor/flowgl/blob/master/PRODUCT.md))
is always more strict than what consumers actually see.

## T6 floors

| Node count | Floor | Target |
| --- | --- | --- |
| 1,000 | 60 fps | 60 fps |
| 5,000 | 30 fps | 60 fps |
| 10,000 | 30 fps | 30 fps |

A PR that drops any tier below its floor is a release blocker. The
workflow opens a `T6 regression` issue automatically on first detection.

## Latest run

<div id="bench-summary" style="margin: 1.5rem 0;">Loading…</div>

## Time-series — 10K node fps over time

<div id="bench-chart" style="margin: 1rem 0 2rem; padding: 16px; background: rgba(99,102,241,0.04); border-radius: 8px;">
  <svg id="bench-svg" viewBox="0 0 760 280" style="width:100%; height:280px;" aria-label="Benchmark time series"></svg>
  <p id="bench-legend" style="margin: 8px 0 0; font-size: 12px; opacity: 0.7;">—</p>
</div>

<script setup lang="ts">
import { onMounted } from 'vue'

onMounted(async () => {
  const summary = document.getElementById('bench-summary')
  const legend  = document.getElementById('bench-legend')
  const svg     = document.getElementById('bench-svg')
  if (!summary || !svg) return

  let data: any[] = []
  try {
    const res = await fetch('/data/benchmarks.json')
    data = await res.json()
  } catch (e) {
    summary.innerHTML = '<em>Awaiting first benchmark run.</em>'
    return
  }
  if (!Array.isArray(data) || data.length === 0) {
    summary.innerHTML = '<em>Awaiting first benchmark run.</em>'
    return
  }

  // Latest summary table
  const latest = data[data.length - 1]
  const rows = latest.results.map((r: any) => {
    const floor = r.count === 1000 ? 60 : 30
    const ok = r.avgFps >= floor
    return `<tr>
      <td>${r.count.toLocaleString()}</td>
      <td>${r.avgFps.toFixed(1)}</td>
      <td>${r.medianFps.toFixed(1)}</td>
      <td>${r.p5Fps.toFixed(1)}</td>
      <td>${r.avgMs.toFixed(2)}</td>
      <td style="color: ${ok ? '#22c55e' : '#ef4444'}; font-weight: 600;">
        ${ok ? '✓' : '✗'} ${floor} fps
      </td>
    </tr>`
  }).join('')
  summary.innerHTML = `
    <p style="font-size: 13px; opacity: 0.75;">
      ${new Date(latest.timestamp).toUTCString()} ·
      dpr ${latest.dpr} ·
      ${latest.userAgent.slice(0, 80)}${latest.userAgent.length > 80 ? '…' : ''}
    </p>
    <table>
      <thead>
        <tr><th>Nodes</th><th>avg fps</th><th>median fps</th><th>p5 fps</th><th>avg ms</th><th>T6 floor</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `

  // SVG time-series (10K node avgFps)
  const W = 760, H = 280, PAD = 40
  const ten = data
    .map((d: any) => d.results.find((r: any) => r.count === 10000))
    .filter(Boolean)
  if (ten.length === 0) {
    svg.innerHTML = `<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#94a3b8">No 10K runs yet</text>`
    return
  }

  const fpsValues = ten.map((r: any) => r.avgFps)
  const minFps = Math.min(20, Math.min(...fpsValues) - 10)
  const maxFps = Math.max(140, Math.max(...fpsValues) + 10)
  const yScale = (fps: number) => H - PAD - ((fps - minFps) / (maxFps - minFps)) * (H - PAD * 2)
  const xScale = (i: number) => PAD + (i / Math.max(1, ten.length - 1)) * (W - PAD * 2)

  // T6 floor line at 30 fps
  const floorY = yScale(30)
  // Axis ticks
  const yTicks = [30, 60, 90, 120].map(v => `
    <line x1="${PAD}" y1="${yScale(v)}" x2="${W - PAD}" y2="${yScale(v)}" stroke="rgba(148,163,184,0.15)" stroke-width="1"/>
    <text x="${PAD - 6}" y="${yScale(v) + 4}" text-anchor="end" font-size="11" fill="#94a3b8">${v}</text>
  `).join('')

  const linePath = fpsValues.map((fps: number, i: number) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(fps)}`).join(' ')
  const dots = fpsValues.map((fps: number, i: number) =>
    `<circle cx="${xScale(i)}" cy="${yScale(fps)}" r="3.5" fill="#6366f1"/>`).join('')

  svg.innerHTML = `
    <g>${yTicks}</g>
    <line x1="${PAD}" y1="${floorY}" x2="${W - PAD}" y2="${floorY}"
          stroke="#ef4444" stroke-dasharray="6 4" stroke-width="1.5"/>
    <text x="${W - PAD}" y="${floorY - 6}" text-anchor="end" font-size="11" fill="#ef4444" font-weight="600">T6 floor (30 fps)</text>
    <path d="${linePath}" fill="none" stroke="#6366f1" stroke-width="2"/>
    ${dots}
  `
  legend.textContent = `${ten.length} run${ten.length === 1 ? '' : 's'} · latest ${fpsValues[fpsValues.length - 1].toFixed(1)} fps`
})
</script>

## How a regression gets caught

1. CI runs `node scripts/run-benchmark.mjs` on the runner.
2. The script measures and writes the result; if any size dropped below
   its T6 floor it exits non-zero.
3. The workflow opens a GitHub issue labeled `regression` + `benchmark` +
   `T6` linking to the failing run.
4. The maintainer triages — either roll back the regressing commit or
   record a Tenet-exception in
   [HISTORY.md](https://github.com/Deiamor/flowgl/blob/master/HISTORY.md)
   if there's an explicit reason to accept the tradeoff.

## Running the benchmark locally

```bash
pnpm install -w -D playwright                    # one-time
pnpm exec playwright install chromium
node scripts/run-benchmark.mjs                   # measures + appends JSON + floor check
node scripts/run-benchmark.mjs --counts 1000     # custom sizes
node scripts/run-benchmark.mjs --no-write        # dry-run, stdout only
```

The script writes to `docs/public/data/benchmarks.json` so that the
chart on this page picks it up on the next docs build / refresh.
