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
