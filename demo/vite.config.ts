import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@flowgl/core':  resolve(__dirname, '../packages/core/src/index.ts'),
      '@flowgl/react': resolve(__dirname, '../packages/react/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main:      resolve(__dirname, 'index.html'),
        react:     resolve(__dirname, 'react.html'),
        benchmark: resolve(__dirname, 'benchmark.html'),
        // Examples gallery — 25 entries, one per HTML in demo/examples/
        examples:                       resolve(__dirname, 'examples/index.html'),
        'examples-minimal':             resolve(__dirname, 'examples/minimal.html'),
        'examples-drag-connect':        resolve(__dirname, 'examples/drag-connect.html'),
        'examples-snap-to-grid':        resolve(__dirname, 'examples/snap-to-grid.html'),
        'examples-keyboard-nav':        resolve(__dirname, 'examples/keyboard-navigation.html'),
        'examples-readonly':            resolve(__dirname, 'examples/readonly.html'),
        'examples-box-select':          resolve(__dirname, 'examples/box-select.html'),
        'examples-cmd-click-multi':     resolve(__dirname, 'examples/cmd-click-multi.html'),
        'examples-programmatic-sel':    resolve(__dirname, 'examples/programmatic-selection.html'),
        'examples-align-distribute':    resolve(__dirname, 'examples/align-distribute.html'),
        'examples-animated':            resolve(__dirname, 'examples/animated-edges.html'),
        'examples-edge-labels':         resolve(__dirname, 'examples/edge-labels.html'),
        'examples-waypoints':           resolve(__dirname, 'examples/waypoints.html'),
        'examples-endpoint-reroute':    resolve(__dirname, 'examples/endpoint-reroute.html'),
        'examples-status-badges':       resolve(__dirname, 'examples/status-badges.html'),
        'examples-html-node':           resolve(__dirname, 'examples/html-node.html'),
        'examples-named-ports':         resolve(__dirname, 'examples/named-ports.html'),
        'examples-cjk':                 resolve(__dirname, 'examples/cjk-labels.html'),
        'examples-groups-collapse':     resolve(__dirname, 'examples/groups-collapse.html'),
        'examples-dissolve-group':      resolve(__dirname, 'examples/dissolve-group.html'),
        'examples-hierarchical':        resolve(__dirname, 'examples/hierarchical-layout.html'),
        'examples-animated-layout':     resolve(__dirname, 'examples/animated-layout.html'),
        'examples-fit-view':            resolve(__dirname, 'examples/fit-view.html'),
        'examples-minimap':             resolve(__dirname, 'examples/minimap.html'),
        'examples-search-highlight':    resolve(__dirname, 'examples/search-highlight.html'),
        'examples-json-roundtrip':      resolve(__dirname, 'examples/json-roundtrip.html'),
        'examples-export-png':          resolve(__dirname, 'examples/export-png.html'),
        'examples-export-svg':          resolve(__dirname, 'examples/export-svg.html'),
      },
    },
  },
})
