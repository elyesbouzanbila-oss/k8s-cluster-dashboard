import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import './Topology.css'

interface TopologyNode {
  id: string
  type: 'pod' | 'service'
  namespace: string
  name: string
  ip?: string
}

interface TopologyProps {
  nodes: TopologyNode[]
  edges: Array<any>
}

export function Topology({ nodes, edges }: TopologyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return

    // Create elements for Cytoscape
    const elements: cytoscape.ElementDefinition[] = [
      // Add nodes
      ...nodes.map(node => ({
        data: {
          id: node.id,
          label: node.name,
          type: node.type,
          namespace: node.namespace,
          ip: node.ip
        }
      })),
      // Add edges (mock connections: pods to services)
      ...nodes
        .filter(n => n.type === 'pod')
        .slice(0, 2)
        .map((pod, idx) => ({
          data: {
            id: `${pod.id}-to-service-${idx}`,
            source: pod.id,
            target: nodes.find(n => n.type === 'service')?.id || 'unknown'
          }
        }))
        .filter(e => e.data.target !== 'unknown')
    ]

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'content': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'font-weight': 'bold',
            'padding': '10px',
            'border-width': '2px',
            'border-color': '#30363d',
            'background-color': '#0066cc',
            'color': '#e6edf3'
          }
        },
        {
          selector: 'node[type="service"]',
          style: {
            'background-color': '#00aa44',
            'shape': 'square'
          }
        },
        {
          selector: 'node[type="pod"]',
          style: {
            'background-color': '#0066cc',
            'shape': 'circle'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': '2px',
            'line-color': '#8b949e',
            'target-arrow-color': '#8b949e',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        }
      ],
      layout: {
        name: 'cose',
        directed: false,
        padding: 10,
        animate: true,
        animationDuration: 500,
        randomize: false,
        componentSpacing: 40,
        nodeSpacing: 10,
        gravity: 1,
        fit: true
      } as any
    })

    cyRef.current = cy

    // Add interactivity
    cy.on('tap', 'node', (event) => {
      const node = event.target
      const data = node.data()
      console.log(`Clicked: ${data.label} (${data.type})`)
    })

    // Cleanup
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy()
      }
    }
  }, [nodes])

  return (
    <div className="topology-container">
      <div ref={containerRef} className="topology-graph" />
      <div className="topology-legend">
        <div className="legend-item">
          <div className="legend-circle pod" />
          <span>Pods</span>
        </div>
        <div className="legend-item">
          <div className="legend-square service" />
          <span>Services</span>
        </div>
      </div>
      <div className="topology-info">
        <p>Nodes: {nodes.length} | Pods: {nodes.filter(n => n.type === 'pod').length} | Services: {nodes.filter(n => n.type === 'service').length}</p>
        <p className="hint">Drag to move • Scroll to zoom • Click nodes for details</p>
      </div>
    </div>
  )
}
