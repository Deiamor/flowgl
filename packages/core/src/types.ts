export interface GridConfig {
  visible: boolean
  /** World-space cell size. Renderer auto-scales for zoom density. */
  size: number
  type: 'dots' | 'lines'
  color: string
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  visible: false,
  size: 20,
  type: 'dots',
  color: 'rgba(0,0,0,0.15)',
}

export interface MinimapConfig {
  /** Minimap panel width in px. Default: 200. */
  width: number
  /** Minimap panel height in px. Default: 150. */
  height: number
  /** Corner to anchor the minimap. Default: 'bottom-right'. */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** Panel background. Default: 'rgba(255,255,255,0.92)'. */
  background: string
  /** Fallback node fill when node has no backgroundColor. Default: '#94a3b8'. */
  nodeColor: string
}

export const DEFAULT_MINIMAP_CONFIG: MinimapConfig = {
  width:      200,
  height:     150,
  position:   'bottom-right',
  background: 'rgba(255,255,255,0.92)',
  nodeColor:  '#94a3b8',
}
