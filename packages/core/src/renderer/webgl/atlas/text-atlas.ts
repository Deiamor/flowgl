// Restored from 1024 back to 2048 in 0.4.1. The 0.2.5 reduction was a
// workaround for a Chromium fillText corruption that 0.2.6's per-entry
// OffscreenCanvas + drawImage strategy eliminated structurally (the live
// atlas never receives fillText directly anymore — every glyph goes through
// a fresh per-entry canvas first). With the per-entry write path in place
// the pixel-parity CDP diagnostic at scripts/atlas-cjk-diag.mjs confirms
// 2048 produces the same nonzero counts as an isolated reproduction at
// every shelf position. The larger atlas postpones eviction by ~4× in
// row capacity, eliminating the mid-frame eviction race that 0.4.0
// surfaced when the demo grew to 12+ labeled nodes including multi-line
// CJK entries.
const ATLAS_SIZE = 2048
// Padding must be ≥ SDF_SPREAD * 2 so the distance field's "halo" around
// every glyph (which extends SDF_SPREAD pixels outward in every direction
// at logical pixel scale, doubled at dpr=2) stays inside the cell — otherwise
// glyphs whose actualBoundingBoxAscent reports a small or negative number
// (Chromium does this for ASCII, Hangul, Kanji) get their SDF clipped at
// the cell's top edge and render as invisible.
const PADDING = 16
const SDF_SPREAD = 4

function propagateEDT(dist: Float32Array, w: number, h: number): void {
  const s2 = Math.SQRT2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let d = dist[i]!
      if (x > 0)              d = Math.min(d, dist[i - 1]!     + 1)
      if (y > 0)              d = Math.min(d, dist[i - w]!     + 1)
      if (x > 0 && y > 0)    d = Math.min(d, dist[i - w - 1]! + s2)
      if (x < w-1 && y > 0)  d = Math.min(d, dist[i - w + 1]! + s2)
      dist[i] = d
    }
  }
  for (let y = h-1; y >= 0; y--) {
    for (let x = w-1; x >= 0; x--) {
      const i = y * w + x
      let d = dist[i]!
      if (x < w-1)              d = Math.min(d, dist[i + 1]!     + 1)
      if (y < h-1)              d = Math.min(d, dist[i + w]!     + 1)
      if (x < w-1 && y < h-1)  d = Math.min(d, dist[i + w + 1]! + s2)
      if (x > 0   && y < h-1)  d = Math.min(d, dist[i + w - 1]! + s2)
      dist[i] = d
    }
  }
}

function computeSDF(pixels: Uint8ClampedArray, w: number, h: number, spread: number): void {
  const n = w * h
  const INF = (spread + 1) * 2
  const dIn  = new Float32Array(n)
  const dOut = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (pixels[i * 4 + 3]! > 127) { dIn[i] = 0; dOut[i] = INF }
    else                          { dIn[i] = INF; dOut[i] = 0 }
  }
  propagateEDT(dIn,  w, h)
  propagateEDT(dOut, w, h)
  for (let i = 0; i < n; i++) {
    const signed = dOut[i]! - dIn[i]!
    pixels[i * 4 + 3] = Math.max(0, Math.min(255, Math.round((0.5 + signed / (2 * spread)) * 255)))
  }
}

interface AtlasEntry {
  u0: number; v0: number; u1: number; v1: number
  w: number; h: number
}

/**
 * Parse the pixel size out of a CSS `font` shorthand like `"14px system-ui"` or
 * `"bold 13px sans-serif"`. Falls back to 14 if no `px` number is present.
 */
function parseFontSize(font: string): number {
  const m = font.match(/(\d+(?:\.\d+)?)px/)
  return m ? parseFloat(m[1]!) : 14
}

function isRTL(text: string): boolean {
  return /[֑-߿יִ-﷽ﹰ-ﻼ]/.test(text)
}

function wrapLines(text: string, maxWidth: number, ctx: OffscreenCanvasRenderingContext2D): string[] {
  if (maxWidth <= 0) return [text]
  const segments = text.split('\n')
  const result: string[] = []
  for (const segment of segments) {
    const words = segment.split(' ')
    let current = ''
    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate
      } else {
        if (current.length > 0) result.push(current)
        current = word
      }
    }
    result.push(current)
  }
  return result.length > 0 ? result : ['']
}

export class TextAtlas {
  private readonly offscreen: OffscreenCanvas
  private readonly ctx: OffscreenCanvasRenderingContext2D
  private readonly entries = new Map<string, AtlasEntry>()
  private texture: WebGLTexture | null = null
  private shelfX = 0
  private shelfY = 0
  private shelfH = 0
  // Logical canvas size in CSS pixels (= ATLAS_SIZE / dpr)
  private readonly logicalSize: number
  private readonly dpr: number
  dirty = false
  generation = 0

  constructor(dpr = 1) {
    this.dpr = Math.max(1, Math.round(dpr))
    this.logicalSize = Math.floor(ATLAS_SIZE / this.dpr)
    this.offscreen = new OffscreenCanvas(ATLAS_SIZE, ATLAS_SIZE)
    const ctx = this.offscreen.getContext('2d')
    if (!ctx) throw new Error('TextAtlas: OffscreenCanvas 2D context unavailable')
    this.ctx = ctx
    // Scale up so CSS-pixel font sizes produce dpr× more physical pixels → crisp text on Retina.
    // dpr=1 is a no-op so we skip the call entirely; calling scale(1,1) was
    // observed to perturb fillText results in some Chromium builds, dropping
    // glyph pixels for entries written far from the canvas origin.
    if (this.dpr !== 1) this.ctx.scale(this.dpr, this.dpr)
  }

  private key(text: string, font: string, color: string, maxWidth: number, lineHeight: number, bgColor: string): string {
    return `${font}|${color}|${maxWidth}|${lineHeight}|${bgColor}|${text}`
  }

  getOrCreate(text: string, font: string, color: string, maxWidth: number, lineHeight: number, bgColor = ''): AtlasEntry | null {
    const k = this.key(text, font, color, maxWidth, lineHeight, bgColor)
    const cached = this.entries.get(k)
    if (cached) return cached

    // Isolate this entry's drawing from any ambient ctx state set by the
    // caller or by a previous getOrCreate. Live trace observed that the
    // chart instance's atlas wrote only 113 of 261 expected pixels for CJK
    // glyphs even though an identical fillText sequence in isolation wrote
    // all 261 — the difference was reproducible only inside the render
    // frame. save()/restore() bracket forces a clean state snapshot for
    // every entry, eliminating any cumulative ctx mutation as a suspect.
    this.ctx.save()
    try {
      return this.buildEntry(k, text, font, color, maxWidth, lineHeight, bgColor)
    } finally {
      this.ctx.restore()
    }
  }

  private buildEntry(k: string, text: string, font: string, color: string, maxWidth: number, lineHeight: number, bgColor: string): AtlasEntry | null {
    this.ctx.font = font
    const lines = wrapLines(text, maxWidth, this.ctx)

    // Extract font-size from `font` ("14px system-ui" → 14) so we have a
    // conservative fallback when measureText returns degenerate metrics
    // (notably for emoji and CJK / Hangul / Hiragana on browsers that
    // don't fill `actualBoundingBox*` correctly).
    const fontSizePx = parseFontSize(font)

    // Pick the widest line's metrics, not just lines[0] — a multi-line
    // label might have any line dominate the height.
    let ascent  = 0
    let descent = 0
    let blockW  = 0
    for (const line of lines) {
      const m = this.ctx.measureText(line)
      // For ascent / descent, take the MAX of:
      //   1. actualBoundingBoxAscent / Descent (per-glyph; can be 0 for emoji)
      //   2. fontBoundingBoxAscent  / Descent  (font-wide; missing in some browsers)
      //   3. fontSizePx * 0.9 / 0.3            (safe minimum so glyphs are never clipped)
      // This combination guarantees the temp canvas is large enough to fit
      // any mix of ASCII + CJK + emoji glyphs without clipping the bottom
      // descender or the top of a tall ideograph.
      const a = Math.max(
        m.actualBoundingBoxAscent ?? 0,
        m.fontBoundingBoxAscent   ?? 0,
        fontSizePx * 0.9,
      )
      const d = Math.max(
        m.actualBoundingBoxDescent ?? 0,
        m.fontBoundingBoxDescent   ?? 0,
        fontSizePx * 0.3,
      )
      if (a > ascent)  ascent  = a
      if (d > descent) descent = d
      // For width, use the MAX of:
      //   1. measureText().width — accurate for ASCII, reliable in most browsers
      //   2. line.length × fontSize × 1.2 — conservative ceiling that covers
      //      CJK / Hangul / emoji whose advance is ≈ font-size per glyph.
      // The previous 0.6 multiplier underestimated Korean by half, so when
      // measureText reported width=37 for "한국어" in the 2048×2048 main atlas
      // canvas (vs 41.5 in the isolated test), the entry was sized too small
      // and the trailing glyphs ran off its right edge during fillText.
      // 1.2 × fontSize per character gives every glyph room without padding
      // the atlas wastefully (ASCII strings still use the smaller measureText
      // when it's larger than the estimate, which it almost always is).
      const measured  = m.width
      const estimated = line.length * fontSizePx * 1.2
      const lw = Math.ceil(Math.max(measured, estimated))
      if (lw > blockW) blockW = lw
    }

    const lineH    = Math.ceil(ascent + descent)
    const lineStep = Math.max(lineH, Math.ceil(lineH * lineHeight))

    // w/h are in CSS (logical) pixels
    const w = blockW + PADDING * 2
    const h = lines.length * lineStep + PADDING * 2

    if (w > this.logicalSize || h > this.logicalSize) return null

    // Per-entry OffscreenCanvas + drawImage (see buildEntry below) means the
    // main atlas ctx never receives fillText directly — every glyph is
    // rasterized in a fresh isolated canvas and pixel-copied in. That makes
    // the 0.2.5-era "fillText drops pixels when neighbours occupy the same
    // row" Chromium quirk a non-issue at the live atlas, so we use the full
    // row width (no 50% wrap limit) and only wrap when the entry actually
    // wouldn't fit.
    if (this.shelfX + w > this.logicalSize) {
      this.shelfY += this.shelfH
      this.shelfX = 0
      this.shelfH = 0
    }
    if (this.shelfY + h > this.logicalSize) {
      // Atlas full — clear and start over (ctx transform survives clearRect)
      this.ctx.clearRect(0, 0, this.logicalSize, this.logicalSize)
      this.entries.clear()
      this.shelfX = 0
      this.shelfY = 0
      this.shelfH = 0
      this.generation++
    }

    // Position the alphabetic baseline of the first line at PADDING + ascent.
    // Using textBaseline='top' here is dangerous: Chromium returns *negative*
    // actualBoundingBoxAscent for many glyphs (e.g. -1.4 for "End" in
    // 16px system-ui), which means the glyph's true top edge sits ABOVE
    // PADDING — by the time SDF_SPREAD widens the field, those pixels get
    // clipped against the offscreen canvas top edge and the glyph's SDF is
    // ruined. Switching to 'alphabetic' + explicit baseline keeps the entire
    // ink (plus its SDF halo) inside the canvas no matter the glyph's sign.
    const baselineY = PADDING + ascent

    // Per-entry OffscreenCanvas architecture: draw the entry's glyphs into
    // its own small canvas first, then drawImage that canvas into the main
    // atlas. After 12 failed fixes on the direct-fillText-into-main approach
    // (live trace: identical fillText writes 261 nz pixels in an isolated
    // OffscreenCanvas but only 113 inside the chart's render frame), every
    // failure mode pointed at some hidden state held by the chart's atlas
    // canvas during the live render that's absent from any isolated repro.
    // A fresh per-entry canvas can't carry that state, and drawImage is a
    // verified-clean pixel copy (live test confirmed 261-nz copy at every
    // position on the main atlas).
    const physW = Math.ceil(w * this.dpr)
    const physH = Math.ceil(h * this.dpr)
    const entryCanvas = new OffscreenCanvas(physW, physH)
    const ec = entryCanvas.getContext('2d')
    if (!ec) return null
    if (this.dpr !== 1) ec.scale(this.dpr, this.dpr)
    ec.font = font
    ec.textBaseline = 'alphabetic'
    ec.textAlign = 'center'
    ec.direction = isRTL(text) ? 'rtl' : 'ltr'
    if (bgColor) {
      ec.fillStyle = bgColor
      ec.fillRect(0, 0, w, h)
    }
    ec.fillStyle = color
    const centerX = PADDING + blockW / 2
    for (let i = 0; i < lines.length; i++) {
      ec.fillText(lines[i]!, centerX, baselineY + i * lineStep)
    }
    // Copy the freshly-rasterized canvas into the main atlas's shelf slot.
    this.ctx.clearRect(this.shelfX, this.shelfY, w, h)
    this.ctx.drawImage(entryCanvas, 0, 0, physW, physH, this.shelfX, this.shelfY, w, h)

    // UV coords are in physical-pixel space (0..ATLAS_SIZE)
    const px = this.shelfX * this.dpr
    const py = this.shelfY * this.dpr
    const entry: AtlasEntry = {
      u0: px / ATLAS_SIZE,
      v0: py / ATLAS_SIZE,
      u1: (px + w * this.dpr) / ATLAS_SIZE,
      v1: (py + h * this.dpr) / ATLAS_SIZE,
      w,
      h,
    }
    this.entries.set(k, entry)

    this.shelfX += w
    if (h > this.shelfH) this.shelfH = h
    this.dirty = true

    return entry
  }

  flush(gl: WebGL2RenderingContext): void {
    if (!this.dirty) return
    if (!this.texture) {
      const tex = gl.createTexture()
      if (!tex) throw new Error('TextAtlas: createTexture failed')
      this.texture = tex
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.offscreen)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.dirty = false
  }

  bind(gl: WebGL2RenderingContext, unit: number): void {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
  }

  dispose(gl: WebGL2RenderingContext): void {
    if (this.texture) gl.deleteTexture(this.texture)
  }
}
