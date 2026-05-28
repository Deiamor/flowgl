import type { Viewport } from '../viewport/viewport'

export interface BoxSelectOptions {
  /** Return true when the pointer is over something else (node/edge) so box-select should not start. */
  shouldBlock: (clientX: number, clientY: number) => boolean
  /** Called with world-space bounds when a drag completes (even zero-size drags are suppressed internally). */
  onSelect: (minX: number, minY: number, maxX: number, maxY: number) => void
}

const MIN_DRAG_PX = 4   // pixels of movement before box is confirmed

export class BoxSelect {
  private canvas: HTMLCanvasElement
  private viewport: Viewport
  private opts: BoxSelectOptions

  private active = false
  private startClientX = 0
  private startClientY = 0
  private overlay: HTMLElement | null = null

  private readonly onMouseDown: (e: MouseEvent) => void
  private readonly onMouseMove: (e: MouseEvent) => void
  private readonly onMouseUp:   (e: MouseEvent) => void

  constructor(canvas: HTMLCanvasElement, viewport: Viewport, opts: BoxSelectOptions) {
    this.canvas   = canvas
    this.viewport = viewport
    this.opts     = opts

    this.onMouseDown = this.handleMouseDown.bind(this)
    this.onMouseMove = this.handleMouseMove.bind(this)
    this.onMouseUp   = this.handleMouseUp.bind(this)

    canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup',   this.onMouseUp)
  }

  isSelecting(): boolean { return this.active }

  private offset(): { left: number; top: number } {
    const r = this.canvas.getBoundingClientRect()
    return { left: r.left, top: r.top }
  }

  private handleMouseDown(e: MouseEvent): void {
    // Only Shift + left button starts box select
    if (e.button !== 0 || !e.shiftKey) return
    if (this.opts.shouldBlock(e.clientX, e.clientY)) return
    e.preventDefault()
    this.active       = true
    this.startClientX = e.clientX
    this.startClientY = e.clientY
    this.createOverlay()
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.active || !this.overlay) return
    this.updateOverlay(e.clientX, e.clientY)
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.active) return
    this.active = false
    this.removeOverlay()

    const dx = Math.abs(e.clientX - this.startClientX)
    const dy = Math.abs(e.clientY - this.startClientY)
    if (dx < MIN_DRAG_PX && dy < MIN_DRAG_PX) return   // too small, ignore

    const { left, top } = this.offset()
    const [wax, way] = this.viewport.screenToWorld(
      Math.min(this.startClientX, e.clientX) - left,
      Math.min(this.startClientY, e.clientY) - top,
    )
    const [wbx, wby] = this.viewport.screenToWorld(
      Math.max(this.startClientX, e.clientX) - left,
      Math.max(this.startClientY, e.clientY) - top,
    )
    this.opts.onSelect(wax, way, wbx, wby)
  }

  private createOverlay(): void {
    const div = document.createElement('div')
    div.style.cssText = `
      position: fixed;
      border: 1.5px dashed rgba(100,160,255,0.8);
      background: rgba(60,120,255,0.06);
      pointer-events: none;
      z-index: 8000;
      box-sizing: border-box;
    `
    document.body.appendChild(div)
    this.overlay = div
    this.updateOverlay(this.startClientX, this.startClientY)
  }

  private updateOverlay(clientX: number, clientY: number): void {
    if (!this.overlay) return
    const x = Math.min(this.startClientX, clientX)
    const y = Math.min(this.startClientY, clientY)
    const w = Math.abs(clientX - this.startClientX)
    const h = Math.abs(clientY - this.startClientY)
    this.overlay.style.left   = `${x}px`
    this.overlay.style.top    = `${y}px`
    this.overlay.style.width  = `${w}px`
    this.overlay.style.height = `${h}px`
  }

  private removeOverlay(): void {
    this.overlay?.remove()
    this.overlay = null
  }

  dispose(): void {
    this.removeOverlay()
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup',   this.onMouseUp)
  }
}
