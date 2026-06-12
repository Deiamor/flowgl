# Export → PDF via SVG

`@flowgl/core` exports SVG natively (`chart.exportSVG(padding)`). PDF
export isn't built in because the right answer depends on whether you
generate the PDF in the browser or on the server. Both paths are short.

## Browser-side PDF via jsPDF + svg2pdf.js

The simplest browser path. Two devDeps, runs entirely client-side.

```bash
npm install jspdf svg2pdf.js
```

```ts
import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'

async function exportPDF(chart) {
  const svgString = chart.exportSVG(40)
  const parser = new DOMParser()
  const svgEl = parser.parseFromString(svgString, 'image/svg+xml').documentElement

  const { width, height } = svgEl.viewBox.baseVal
  const pdf = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
  })

  await svg2pdf(svgEl, pdf, { x: 0, y: 0, width, height })
  pdf.save('flowgl.pdf')
}
```

jsPDF + svg2pdf preserves vector paths (the bezier curves and shape
polygons stay sharp at any zoom level in the PDF). Text is also vector
where the renderer supports the font.

## Browser-side PDF via Canvg → Canvas → PNG → jsPDF

If you need pixel-perfect fidelity (gradients, filters, weird CSS) and
don't mind a raster PDF:

```bash
npm install canvg jspdf
```

```ts
import { Canvg } from 'canvg'
import { jsPDF } from 'jspdf'

async function exportPDF(chart) {
  const svg = chart.exportSVG(40)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const v = await Canvg.from(ctx, svg)
  await v.render()

  const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] })
  pdf.addImage(canvas, 'PNG', 0, 0, canvas.width, canvas.height)
  pdf.save('flowgl.pdf')
}
```

## Server-side PDF via Puppeteer / Playwright

For higher-quality output or batch generation, send the SVG to a
headless browser that's already in your pipeline:

```ts
// server/pdf.ts
import { chromium } from 'playwright'

export async function svgToPdf(svgString: string): Promise<Buffer> {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent(`
    <html><body style="margin:0;background:white;">${svgString}</body></html>
  `)
  const pdf = await page.pdf({ format: 'A4', printBackground: true })
  await browser.close()
  return pdf
}
```

```ts
// client
const svg = chart.exportSVG(40)
const res = await fetch('/api/export-pdf', { method: 'POST', body: svg })
const blob = await res.blob()
const url = URL.createObjectURL(blob)
window.open(url)
```

This path is vector-clean (Chromium's PDF backend) and supports CSS
that the in-browser converters don't handle well, but adds a server
hop and a Playwright dependency.

## Server-side PDF via Resvg / rsvg-convert

For purely server-side generation without a headless browser:

```bash
# Rust binary
npm install @resvg/resvg-js
```

```ts
import { Resvg } from '@resvg/resvg-js'
import { PDFDocument } from 'pdf-lib'

async function svgToPdf(svgString: string): Promise<Uint8Array> {
  const resvg = new Resvg(svgString, { fitTo: { mode: 'original' } })
  const pngBuffer = resvg.render().asPng()

  const pdfDoc = await PDFDocument.create()
  const pngImage = await pdfDoc.embedPng(pngBuffer)
  const page = pdfDoc.addPage([pngImage.width, pngImage.height])
  page.drawImage(pngImage, { x: 0, y: 0, width: pngImage.width, height: pngImage.height })
  return pdfDoc.save()
}
```

This is the lightest server-side path — no Chromium dependency, runs in
serverless / edge environments where launching browsers is expensive or
disallowed.

## See also

- [Export SVG example](https://dev.flowgl.ouranos.kr/examples/export-svg.html)
- [Export PNG example](https://dev.flowgl.ouranos.kr/examples/export-png.html)
- [API reference — `exportSVG` / `exportPNG`](/api/flowchart)
