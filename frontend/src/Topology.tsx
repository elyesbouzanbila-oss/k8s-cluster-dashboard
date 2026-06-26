import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import './Topology.css'

interface TopologyNode {
  id: string
  type: 'pod' | 'service' | 'node'
  namespace?: string
  name: string
  ip?: string
  labels?: Record<string, string>
  node_name?: string
}

interface TopologyEdge {
  id: string
  source: string
  target: string
}

interface TopologyProps {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

// Color scheme by namespace
const NAMESPACE_COLORS: Record<string, string> = {
  'default': '#3B82F6',      // Bright blue
  'kube-system': '#8B5CF6',  // Purple
  'kube-public': '#06B6D4',  // Cyan
  'kube-node-lease': '#10B981', // Green
}

// Color scheme by node (worker nodes, master node)
const NODE_COLORS: Record<string, string> = {
  'masternode': '#EC4899',     // Pink
  'workernode1': '#F59E0B',    // Amber
  'workernode2': '#14B8A6',    // Teal
}

const getNamespaceColor = (namespace?: string): string => {
  return namespace ? (NAMESPACE_COLORS[namespace] || '#6366F1') : '#6366F1'
}

const getNodeColor = (nodeName?: string): string => {
  return nodeName ? (NODE_COLORS[nodeName] || '#9333EA') : '#9333EA'
}

export function Topology({ nodes, edges }: TopologyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return

    // Create elements for Cytoscape
    const elements: cytoscape.ElementDefinition[] = [
      ...nodes
        .filter(n => n.type === 'pod' || n.type === 'service')
        .map(node => ({
          data: {
            id: node.id,
            label: node.name,
            type: node.type,
            namespace: node.namespace,
            ip: node.ip,
            labels: node.labels,
            node_name: node.node_name,
            parent: node.type === 'pod' ? node.node_name : undefined
          }
        })),
      ...edges.map(edge => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target
        }
      }))
    ]

    // Initialize Cytoscape with valid selectors only
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        // Pod styling - colored by node
        {
          selector: 'node[type="pod"]',
          style: {
            'content': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '10px',
            'font-weight': 'bold',
            'padding': '5px',
            'border-width': '2px',
            'border-color': 'rgba(255, 255, 255, 0.4)',
            'background-color': (ele: any) => getNodeColor(ele.data('node_name')),
            'color': '#ffffff',
            'text-wrap': 'wrap',
            'text-max-width': '70px',
            'min-zoomed-font-size': 8,
            'shape': 'ellipse',
            'width': '45px',
            'height': '45px'
          }
        },
        // Service styling - colored by namespace
        {
          selector: 'node[type="service"]',
          style: {
            'content': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '11px',
            'font-weight': 'bold',
            'padding': '6px',
            'border-width': '3px',
            'border-color': 'rgba(255, 255, 255, 0.5)',
            'background-color': (ele: any) => getNamespaceColor(ele.data('namespace')),
            'color': '#ffffff',
            'text-wrap': 'wrap',
            'text-max-width': '75px',
            'shape': 'rectangle',
            'width': '50px',
            'height': '50px'
          }
        },
        // Selected state for pods
        {
          selector: 'node[type="pod"].selected',
          style: {
            'border-color': '#FCD34D',
            'border-width': '3px'
          }
        },
        // Selected state for services
        {
          selector: 'node[type="service"].selected',
          style: {
            'border-color': '#FCD34D',
            'border-width': '4px'
          }
        },
        // Edge styling
        {
          selector: 'edge',
          style: {
            'width': '1.5px',
            'line-color': 'rgba(148, 163, 184, 0.4)',
            'target-arrow-color': 'rgba(148, 163, 184, 0.4)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.6
          }
        },
        // Edge hover state
        {
          selector: 'edge.selected',
          style: {
            'line-color': '#3B82F6',
            'target-arrow-color': '#3B82F6',
            'width': '2px',
            'opacity': 1
          }
        }
      ],
      layout: {
        name: 'cose',
        directed: true,
        padding: 20,
        animate: true,
        animationDuration: 500,
        randomize: false,
        componentSpacing: 80,
        nodeSpacing: 25,
        gravity: 0.7,
        fit: true,
        coolingFactor: 0.98,
        minTemp: 1,
      } as any
    })

    cyRef.current = cy

    // Add interactivity with event-based hover
    cy.on('mouseover', 'node', (event) => {
      event.target.addClass('selected')
    })

    cy.on('mouseout', 'node', (event) => {
      event.target.removeClass('selected')
    })

    cy.on('mouseover', 'edge', (event) => {
      event.target.addClass('selected')
    })

    cy.on('mouseout', 'edge', (event) => {
      event.target.removeClass('selected')
    })

    cy.on('tap', 'node', (event) => {
      const node = event.target
      const data = node.data()
      if (data.type === 'pod') {
        console.log(`Pod: ${data.label} | Node: ${data.node_name} | Namespace: ${data.namespace} | IP: ${data.ip}`)
      } else {
        console.log(`Service: ${data.label} | Namespace: ${data.namespace}`)
      }
    })

    // Double-click to fit all
    cy.on('dbltap', () => {
      cy.fit()
    })

    // Cleanup
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy()
      }
    }
  }, [nodes, edges])

  const namespaceCounts = nodes
    .filter(n => n.type === 'pod' || n.type === 'service')
    .reduce((acc, node) => {
      const ns = node.namespace || 'unknown'
      acc[ns] = (acc[ns] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  const nodeCounts = nodes
    .filter(n => n.type === 'pod' && n.node_name)
    .reduce((acc, node) => {
      const nodeName = node.node_name as string
      acc[nodeName] = (acc[nodeName] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  const podCount = nodes.filter(n => n.type === 'pod').length
  const serviceCount = nodes.filter(n => n.type === 'service').length
  const nodeNames = Object.keys(nodeCounts)

  return (
    <div className="topology-container">
      <div ref={containerRef} className="topology-graph" />
      <div className="topology-legend">
        <div className="legend-section">
          <div className="legend-title">Pod Types</div>
          <div className="legend-item">
            <div className="legend-shape pod" />
            <span>Pods ({podCount})</span>
          </div>
          <div className="legend-item">
            <div className="legend-shape service" />
            <span>Services ({serviceCount})</span>
          </div>
        </div>
        
        <div className="legend-section">
          <div className="legend-title">Nodes (Pod Location)</div>
          {nodeNames.length > 0 ? (
            nodeNames.map((nodeName) => (
              <div key={nodeName} className="legend-item">
                <div 
                  className="legend-color" 
                  style={{ backgroundColor: getNodeColor(nodeName) }}
                />
                <span>{nodeName} ({nodeCounts[nodeName]})</span>
              </div>
            ))
          ) : (
            <div className="legend-item" style={{ color: '#94a3b8' }}>
              No node data
            </div>
          )}
        </div>

        <div className="legend-section">
          <div className="legend-title">Namespaces (Services)</div>
          {Object.entries(namespaceCounts).map(([ns, count]) => (
            <div key={ns} className="legend-item">
              <div 
                className="legend-color" 
                style={{ backgroundColor: getNamespaceColor(ns) }}
              />
              <span>{ns} ({count})</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="topology-info">
        <div className="info-row">
          <span className="info-label">Pods:</span>
          <span className="info-value">{podCount}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Services:</span>
          <span className="info-value">{serviceCount}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Nodes:</span>
          <span className="info-value">{nodeNames.length}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Connections:</span>
          <span className="info-value">{edges.length}</span>
        </div>
        <div className="info-row hint">
          💡 Colored by node • Hover for highlights • Double-click to fit
        </div>
      </div>
    </div>
  )
}
