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
    // Scale up so CSS-pixel font sizes produce dpr× more physical pixels → crisp text on Retina
    this.ctx.scale(this.dpr, this.dpr)
    // textBaseline is set per-fillText below (always 'alphabetic'); no need
    // to pre-configure here.
  }

  private key(text: string, font: string, color: string, maxWidth: number, lineHeight: number, bgColor: string): string {
    return `${font}|${color}|${maxWidth}|${lineHeight}|${bgColor}|${text}`
  }

  getOrCreate(text: string, font: string, color: string, maxWidth: number, lineHeight: number, bgColor = ''): AtlasEntry | null {
    const k = this.key(text, font, color, maxWidth, lineHeight, bgColor)
    const cached = this.entries.get(k)
    if (cached) return cached

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
      // For width, fall back to a conservative estimate based on character
      // count if `m.width` reports near-zero (Chromium did this for some
      // emoji codepoints prior to v118).
      const measured = m.width
      const estimated = line.length * fontSizePx * 0.6
      const lw = Math.ceil(Math.max(measured, estimated))
      if (lw > blockW) blockW = lw
    }

    const lineH    = Math.ceil(ascent + descent)
    const lineStep = Math.max(lineH, Math.ceil(lineH * lineHeight))

    // w/h are in CSS (logical) pixels
    const w = blockW + PADDING * 2
    const h = lines.length * lineStep + PADDING * 2

    if (w > this.logicalSize || h > this.logicalSize) return null

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

    if (bgColor) {
      this.ctx.fillStyle = bgColor
      this.ctx.fillRect(this.shelfX, this.shelfY, w, h)
      this.ctx.fillStyle = color
      this.ctx.textBaseline = 'alphabetic'
      this.ctx.direction = isRTL(text) ? 'rtl' : 'ltr'
      for (let i = 0; i < lines.length; i++) {
        this.ctx.fillText(lines[i]!, this.shelfX + PADDING, this.shelfY + baselineY + i * lineStep)
      }
    } else {
      // Glyph path. The previous "SDF (signed distance field) compute via
      // temp canvas + putImageData" pipeline turned out to silently drop ASCII
      // and CJK glyphs that follow an emoji in the same string — the
      // emoji's actualBoundingBox metrics confused either computeSDF or
      // putImageData enough that the trailing glyphs ended up with alpha=0 in
      // the atlas. Rendering directly into the main atlas via fillText draws
      // every glyph correctly. The fragment shader still uses smoothstep so
      // labels stay sharp at higher zoom levels.
      this.ctx.fillStyle = color
      this.ctx.textBaseline = 'alphabetic'
      this.ctx.direction = isRTL(text) ? 'rtl' : 'ltr'
      for (let i = 0; i < lines.length; i++) {
        this.ctx.fillText(lines[i]!, this.shelfX + PADDING, this.shelfY + baselineY + i * lineStep)
      }
    }

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
