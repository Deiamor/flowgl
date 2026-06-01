import { useState, useRef, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { Flowchart } from '@flowchart/react'
import type { NodeData, EdgeData, FlowChart } from '@flowchart/react'

const initialNodes: NodeData[] = [
  { id: 'n1', x: 80,  y: 180, width: 150, height: 52, label: 'Start',
    style: { backgroundColor: '#e8f5e9', borderColor: '#43a047', shape: 'circle' } },
  { id: 'n2', x: 340, y: 180, width: 150, height: 52, label: 'Process',
    style: { backgroundColor: '#e3f2fd', borderColor: '#1e88e5' } },
  { id: 'n3', x: 600, y: 100, width: 150, height: 52, label: 'Branch A',
    style: { backgroundColor: '#fff8e1', borderColor: '#f9a825', shape: 'diamond' } },
  { id: 'n4', x: 600, y: 260, width: 150, height: 52, label: 'Branch B',
    style: { backgroundColor: '#fce4ec', borderColor: '#e53935', shape: 'hexagon' } },
]

const initialEdges: EdgeData[] = [
  { id: 'e1', source: 'n1', target: 'n2' },
  { id: 'e2', source: 'n2', target: 'n3' },
  { id: 'e3', source: 'n2', target: 'n4', style: { dashArray: [8, 4] } },
]

let nodeCounter = 5

function App() {
  const [nodes, setNodes] = useState<NodeData[]>(initialNodes)
  const [edges, setEdges] = useState<EdgeData[]>(initialEdges)
  const [selectedCount, setSelectedCount] = useState(0)
  const chartRef = useRef<FlowChart | null>(null)

  const handleNodesChange = useCallback((updated: NodeData[]) => {
    setNodes(updated)
  }, [])

  const handleEdgesChange = useCallback((updated: EdgeData[]) => {
    setEdges(updated)
  }, [])

  const handleSelectionChange = useCallback(({ selectedIds }: { selectedIds: string[]; edgeIds: string[] }) => {
    setSelectedCount(selectedIds.length)
  }, [])

  const addNode = () => {
    const id = `n${nodeCounter++}`
    setNodes(prev => [...prev, {
      id,
      x: 100 + Math.random() * 400,
      y: 400 + Math.random() * 200,
      width: 150, height: 52,
      label: `Node ${id}`,
    }])
  }

  const fitView = () => chartRef.current?.fitView()
  const undo    = () => chartRef.current?.undo()
  const redo    = () => chartRef.current?.redo()

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      {/* Sidebar */}
      <div style={{
        width: 200, flexShrink: 0, background: 'rgba(20,24,48,0.95)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
        fontFamily: 'system-ui', color: '#d1d5db',
      }}>
        <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          React Demo
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          nodes: {nodes.length} · edges: {edges.length}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          selected: {selectedCount}
        </div>
        {[
          { label: 'Fit View',  action: fitView },
          { label: '+ Add Node', action: addNode },
          { label: '↩ Undo',     action: undo    },
          { label: '↪ Redo',     action: redo    },
        ].map(({ label, action }) => (
          <button key={label} onClick={action} style={{
            padding: '8px 12px', border: 'none', borderRadius: 6,
            background: '#1e2d5a', color: '#d1d5db', cursor: 'pointer',
            fontSize: 13, textAlign: 'left',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Flowchart
          ref={chartRef}
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onSelectionChange={handleSelectionChange}
          minimap={{ position: 'bottom-left' }}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
