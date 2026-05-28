const ATLAS_SIZE = 2048
const PADDING = 4

interface AtlasEntry {
  u0: number; v0: number; u1: number; v1: number
  w: number; h: number
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

  private key(text: string, font: string): string {
    return `${font}|${text}`
  }

  getOrCreate(text: string, font: string, color: string): AtlasEntry | null {
    const k = this.key(text, font)
    const cached = this.entries.get(k)
    if (cached) return cached

    this.ctx.font = font
    const metrics = this.ctx.measureText(text)
    const w = Math.ceil(metrics.width) + PADDING * 2
    const h = Math.ceil(
      (metrics.actualBoundingBoxAscent ?? 0) + (metrics.actualBoundingBoxDescent ?? 0),
    ) + PADDING * 2

    if (w > ATLAS_SIZE) return null

    if (this.shelfX + w > ATLAS_SIZE) {
      this.shelfY += this.shelfH
      this.shelfX = 0
      this.shelfH = 0
    }
    if (this.shelfY + h > ATLAS_SIZE) {
      // Atlas full — clear and start over
      this.ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)
      this.entries.clear()
      this.shelfX = 0
      this.shelfY = 0
      this.shelfH = 0
    }

    this.ctx.fillStyle = color
    this.ctx.fillText(text, this.shelfX + PADDING, this.shelfY + PADDING)

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
