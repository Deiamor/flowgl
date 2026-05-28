const ATLAS_SIZE = 2048
const PADDING = 4

interface AtlasEntry {
  u0: number; v0: number; u1: number; v1: number
  w: number; h: number
}

function isRTL(text: string): boolean {
  return /[֑-߿יִ-﷽ﹰ-ﻼ]/.test(text)
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
  dirty = false

  constructor() {
    this.offscreen = new OffscreenCanvas(ATLAS_SIZE, ATLAS_SIZE)
    const ctx = this.offscreen.getContext('2d')
    if (!ctx) throw new Error('TextAtlas: OffscreenCanvas 2D context unavailable')
    this.ctx = ctx
    this.ctx.textBaseline = 'top'
  }

  private key(text: string, font: string, maxWidth: number, lineHeight: number): string {
    return `${font}|${maxWidth}|${lineHeight}|${text}`
  }

  getOrCreate(text: string, font: string, color: string, maxWidth: number, lineHeight: number): AtlasEntry | null {
    const k = this.key(text, font, maxWidth, lineHeight)
    const cached = this.entries.get(k)
    if (cached) return cached

    this.ctx.font = font
    const lines = wrapLines(text, maxWidth, this.ctx)

    const sample = this.ctx.measureText(lines[0] ?? '')
    const lineH = Math.ceil(
      (sample.actualBoundingBoxAscent ?? 0) + (sample.actualBoundingBoxDescent ?? 0),
    )
    const lineStep = Math.max(lineH, Math.ceil(lineH * lineHeight))

    let blockW = 0
    for (const line of lines) {
      const lw = Math.ceil(this.ctx.measureText(line).width)
      if (lw > blockW) blockW = lw
    }

    const w = blockW + PADDING * 2
    const h = lines.length * lineStep + PADDING * 2

    if (w > ATLAS_SIZE || h > ATLAS_SIZE) return null

    if (this.shelfX + w > ATLAS_SIZE) {
      this.shelfY += this.shelfH
      this.shelfX = 0
      this.shelfH = 0
    }
    if (this.shelfY + h > ATLAS_SIZE) {
      this.ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)
      this.entries.clear()
      this.shelfX = 0
      this.shelfY = 0
      this.shelfH = 0
    }

    this.ctx.fillStyle = color
    this.ctx.direction = isRTL(text) ? 'rtl' : 'ltr'

    for (let i = 0; i < lines.length; i++) {
      this.ctx.fillText(lines[i]!, this.shelfX + PADDING, this.shelfY + PADDING + i * lineStep)
    }

    const entry: AtlasEntry = {
      u0: this.shelfX / ATLAS_SIZE,
      v0: this.shelfY / ATLAS_SIZE,
      u1: (this.shelfX + w) / ATLAS_SIZE,
      v1: (this.shelfY + h) / ATLAS_SIZE,
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
