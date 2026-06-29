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
  role?: 'master' | 'worker'
  node_ip?: string
  capacity?: Record<string, string>
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

// ─── Color palette ──────────────────────────────────────────────
const COLORS = {
  master: '#EC4899',        // Pink
  masterBg: 'rgba(236, 72, 153, 0.08)',
  masterBorder: 'rgba(236, 72, 153, 0.4)',
  worker: '#3B82F6',        // Blue
  workerBg: 'rgba(59, 130, 246, 0.06)',
  workerBorder: 'rgba(59, 130, 246, 0.3)',
  service: '#8B5CF6',       // Purple
  serviceBg: 'rgba(139, 92, 246, 0.12)',
  // Pod colors by namespace
  namespaces: {
    'kube-system': '#F59E0B',
    'production': '#10B981',
    'monitoring': '#06B6D4',
  } as Record<string, string>,
}

const getNamespaceColor = (ns?: string): string =>
  (ns && COLORS.namespaces[ns]) || '#6366F1'

export function Topology({ nodes, edges }: TopologyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const toastRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

  // Derived data for info panel
  const clusterNodes = nodes.filter(n => n.type === 'node')
  const masterNodes = clusterNodes.filter(n => n.role === 'master')
  const workerNodes = clusterNodes.filter(n => n.role === 'worker')
  const podNodes = nodes.filter(n => n.type === 'pod')
  const serviceNodes = nodes.filter(n => n.type === 'service')

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return

    // Separate nodes by type
    const clusterNodeEntries = nodes.filter(n => n.type === 'node')
    const podEntries = nodes.filter(n => n.type === 'pod')
    const serviceEntries = nodes.filter(n => n.type === 'service')

    // Build Cytoscape elements
    const elements: cytoscape.ElementDefinition[] = [
      // Cluster nodes as compound parents
      ...clusterNodeEntries.map(node => ({
        data: {
          id: node.id,
          label: node.name,
          type: 'clusternode',
          role: node.role,
          ip: node.ip,
          capacity: node.capacity,
          // "node" is a compound node — pods will set parent to node.id
        },
        // Placeholder position — the layout will refine it
        position: { x: 0, y: 0 },
      })),
      // Pods as children of their respective cluster node
      ...podEntries.map(pod => ({
        data: {
          id: pod.id,
          label: pod.name,
          type: 'pod',
          namespace: pod.namespace,
          ip: pod.ip,
          node_name: pod.node_name,
          labels: pod.labels,
          parent: pod.node_name ? `node:${pod.node_name}` : undefined,
        },
      })),
      // Services as standalone nodes
      ...serviceEntries.map(svc => ({
        data: {
          id: svc.id,
          label: svc.name,
          type: 'service',
          namespace: svc.namespace,
          ip: svc.ip,
        },
        position: { x: 0, y: 0 },
      })),
      // Edges
      ...edges.map(edge => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
        },
      })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        // ── Compound cluster node (master) with label showing name + IP ──
        {
          selector: 'node[type="clusternode"][role="master"]',
          style: {
            'background-color': COLORS.masterBg,
            'border-color': COLORS.masterBorder,
            'border-width': 2,
            'border-style': 'dashed',
            'border-opacity': 0.8,
            'label': (ele: any) => {
              const name = ele.data('label') || ''
              const ip = ele.data('ip') || ''
              return ip ? `${name}\n${ip}` : name
            },
            'color': COLORS.master,
            'font-size': '13px',
            'font-weight': '700',
            'text-valign': 'top',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'padding': '20px',
            'shape': 'round-rectangle',
            'text-margin-y': 4,
            'min-width': '280px',
            'min-height': '200px',
            'width': '320px',
            'height': '260px',
          } as any,
        },
        // ── Compound cluster node (worker) with label showing name + IP ──
        {
          selector: 'node[type="clusternode"][role="worker"]',
          style: {
            'background-color': COLORS.workerBg,
            'border-color': COLORS.workerBorder,
            'border-width': 2,
            'border-style': 'dashed',
            'border-opacity': 0.7,
            'label': (ele: any) => {
              const name = ele.data('label') || ''
              const ip = ele.data('ip') || ''
              return ip ? `${name}\n${ip}` : name
            },
            'color': COLORS.worker,
            'font-size': '13px',
            'font-weight': '700',
            'text-valign': 'top',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'padding': '20px',
            'shape': 'round-rectangle',
            'text-margin-y': 4,
            'min-width': '280px',
            'min-height': '200px',
            'width': '320px',
            'height': '260px',
          } as any,
        },
        // ── Node IP label (shown as a separate text element via wrapper) ──
        // We'll use the node label to include IP info
        // ── Pod nodes inside compound parents ──
        {
          selector: 'node[type="pod"]',
          style: {
            'content': (ele: any) => {
              const label = ele.data('label') || ''
              const ip = ele.data('ip') || ''
              // Show name truncated and IP on next line
              const shortName = label.length > 18 ? label.slice(0, 16) + '…' : label
              return ip ? `${shortName}\n${ip}` : shortName
            },
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '8px',
            'font-weight': '600',
            'color': '#ffffff',
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            'background-color': (ele: any) => getNamespaceColor(ele.data('namespace')),
            'border-width': 1.5,
            'border-color': 'rgba(255, 255, 255, 0.3)',
            'border-opacity': 0.5,
            'shape': 'ellipse',
            'width': '72px',
            'height': '56px',
            'min-zoomed-font-size': 6,
          } as any,
        },
        // ── Service nodes ──
        {
          selector: 'node[type="service"]',
          style: {
            'content': (ele: any) => {
              const label = ele.data('label') || ''
              const ip = ele.data('ip') || ''
              const shortName = label.length > 14 ? label.slice(0, 12) + '…' : label
              return ip ? `${shortName}\n${ip}` : shortName
            },
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '9px',
            'font-weight': '600',
            'color': '#ffffff',
            'text-wrap': 'wrap',
            'text-max-width': '90px',
            'background-color': COLORS.service,
            'border-width': 2,
            'border-color': 'rgba(255, 255, 255, 0.35)',
            'shape': 'round-rectangle',
            'width': '90px',
            'height': '60px',
            'min-zoomed-font-size': 7,
          } as any,
        },
        // ── Selected / hover states ──
        {
          selector: 'node[type="pod"]:selected, node[type="pod"]:active',
          style: {
            'border-color': '#FCD34D',
            'border-width': 3,
            'border-opacity': 1,
            'shadow-blur': 12,
            'shadow-color': '#FCD34D',
            'shadow-opacity': 0.5,
            'shadow-offset-x': 0,
            'shadow-offset-y': 0,
          },
        },
        {
          selector: 'node[type="service"]:selected, node[type="service"]:active',
          style: {
            'border-color': '#FCD34D',
            'border-width': 3,
            'shadow-blur': 12,
            'shadow-color': '#FCD34D',
            'shadow-opacity': 0.5,
          },
        },
        {
          selector: 'node[type="clusternode"]:selected',
          style: {
            'border-color': '#FCD34D',
            'border-width': 3,
            'shadow-blur': 16,
            'shadow-color': '#FCD34D',
            'shadow-opacity': 0.3,
          },
        },
        // ── Edges ──
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': 'rgba(148, 163, 184, 0.35)',
            'target-arrow-color': 'rgba(148, 163, 184, 0.35)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.5,
          },
        },
        {
          selector: 'edge:selected, edge:active',
          style: {
            'line-color': '#3B82F6',
            'target-arrow-color': '#3B82F6',
            'width': 2.5,
            'opacity': 1,
          },
        },
      ],
      layout: {
        name: 'preset',
        fit: false,  // We'll fit manually after positioning
      } as any,
    })

    cyRef.current = cy

    // ── Dynamic manual layout based on container size ──
    const containerWidth = containerRef.current.clientWidth || 1000
    const nodeW = 320
    const nodeH = 260
    const gapX = 30
    const gapY = 40

    // Separate nodes by type
    const masters = cy.nodes('[type="clusternode"][role="master"]')
    const workers = cy.nodes('[type="clusternode"][role="worker"]')
    const services = cy.nodes('[type="service"]')

    // Calculate the total width each row needs
    const rowWidth = (count: number) => Math.max(0, count * (nodeW + gapX) - gapX)
    const masterRowW = rowWidth(masters.length)
    const workerRowW = rowWidth(workers.length)
    const svcAreaW = services.length > 0 ? 150 : 0
    const maxRowW = Math.max(masterRowW, workerRowW) + svcAreaW

    // Center everything in the container
    const leftMargin = Math.max(20, (containerWidth - maxRowW) / 2)

    // Y positions for each row
    const masterY = nodeH / 2 + 20
    const workerY = masterY + nodeH / 2 + gapY + nodeH / 2

    // ── Position master nodes (top row, centered) ──
    const mStartX = leftMargin + (maxRowW - svcAreaW - masterRowW) / 2 + nodeW / 2
    masters.forEach((n: any, i: number) => {
      n.position({ x: mStartX + i * (nodeW + gapX), y: masterY })
    })

    // ── Position worker nodes (second row, centered) ──
    const wStartX = leftMargin + (maxRowW - svcAreaW - workerRowW) / 2 + nodeW / 2
    workers.forEach((n: any, i: number) => {
      n.position({ x: wStartX + i * (nodeW + gapX), y: workerY })
    })

    // ── Position services (right column) ──
    const svcX = leftMargin + maxRowW - svcAreaW + 30 + 45
    services.forEach((n: any, i: number) => {
      n.position({ x: svcX, y: 80 + i * 90 })
    })

    // ── Arrange children (pods) in a grid inside each compound node ──      // NOTE: Cytoscape.js child positions are RELATIVE to their parent's center.
    cy.nodes('[type="clusternode"]').each((parent: any) => {
      const children = parent.children()
      if (children.length === 0) return

      const innerW = nodeW - 40
      const innerH = nodeH - 70
      const cols = Math.min(Math.max(1, Math.ceil(Math.sqrt(children.length))), 4)
      const rows = Math.ceil(children.length / cols)
      const cellW = Math.min(innerW / cols, 100)
      const cellH = Math.min(innerH / rows, 80)
      const gridW = cols * cellW
      const gridH = rows * cellH
      // Use coordinates relative to parent center (not absolute)
      const startX = -gridW / 2 + cellW / 2
      const startY = -gridH / 2 + cellH / 2 + 10

      children.forEach((child: any, idx: number) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        child.position({
          x: startX + col * cellW,
          y: startY + row * cellH,
        })
      })
    })

    // Fit the viewport to show all nodes
    cy.fit(undefined, 30)

    // ── Interactivity ──
    cy.on('mouseover', 'node[type="pod"], node[type="service"]', (event: any) => {
      event.target.addClass('selected')
    })

    cy.on('mouseout', 'node[type="pod"], node[type="service"]', (event: any) => {
      event.target.removeClass('selected')
    })

    cy.on('mouseover', 'node[type="clusternode"]', (event: any) => {
      event.target.addClass('selected')
    })

    cy.on('mouseout', 'node[type="clusternode"]', (event: any) => {
      event.target.removeClass('selected')
    })

    cy.on('mouseover', 'edge', (event: any) => {
      event.target.addClass('selected')
    })

    cy.on('mouseout', 'edge', (event: any) => {
      event.target.removeClass('selected')
    })

    // Click to show details
    cy.on('tap', 'node', (event: any) => {
      const node = event.target
      const d = node.data()
      const info: string[] = []

      if (d.type === 'clusternode') {
        info.push(`🖥️  Node: ${d.label}`)
        info.push(`🎯 Role: ${d.role === 'master' ? 'Control Plane (Master)' : 'Worker'}`)
        if (d.ip) info.push(`🌐 IP: ${d.ip}`)
        if (d.capacity) {
          info.push(`💻 CPU: ${d.capacity.cpu || '?'}  |  RAM: ${d.capacity.memory || '?'}`)
        }
        const childCount = node.children().length
        info.push(`📦 Pods: ${childCount}`)
      } else if (d.type === 'pod') {
        info.push(`📦 Pod: ${d.label}`)
        if (d.namespace) info.push(`📁 Namespace: ${d.namespace}`)
        if (d.ip) info.push(`🌐 IP: ${d.ip}`)
        if (d.node_name) info.push(`🖥️  Node: ${d.node_name}`)
      } else if (d.type === 'service') {
        info.push(`🔗 Service: ${d.label}`)
        if (d.namespace) info.push(`📁 Namespace: ${d.namespace}`)
        if (d.ip) info.push(`🌐 Cluster IP: ${d.ip}`)
        // Count connected pods
        const connectedPods = cy.edges(`[source = "${d.id}"], [target = "${d.id}"]`).connectedNodes()
        const podCount = connectedPods.filter((n: any) => n.data('type') === 'pod').length
        info.push(`🔌 Connected Pods: ${podCount}`)
      }

      // Show a toast-like info bar at the bottom of the graph
      const infoBar = toastRef.current
      if (infoBar) {
        infoBar.textContent = info.join('  •  ')
        infoBar.classList.add('visible')
        if ((infoBar as any)._hideTimer) clearTimeout((infoBar as any)._hideTimer)
        ;(infoBar as any)._hideTimer = setTimeout(() => {
          infoBar.classList.remove('visible')
        }, 6000)
      }
    })

    // Double-click to fit
    cy.on('dbltap', () => {
      cy.fit(undefined, 30)
    })

    // Cleanup
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy()
      }
    }
  }, [nodes, edges])

  // ── Pod counts by namespace (for legend) ──
  const namespaceCounts = podNodes.reduce((acc, node) => {
    const ns = node.namespace || 'unknown'
    acc[ns] = (acc[ns] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const podCountByNode = podNodes.reduce((acc, pod) => {
    const n = pod.node_name || 'unknown'
    acc[n] = (acc[n] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="topology-container">
      {/* Info bar above the graph */}
      <div className="topology-stats-bar">
        <div className="stat">
          <span className="stat-dot master-dot" />
          <span>Master: {masterNodes.length}</span>
        </div>
        <div className="stat">
          <span className="stat-dot worker-dot" />
          <span>Workers: {workerNodes.length}</span>
        </div>
        <div className="stat">
          <span className="stat-dot pod-dot" />
          <span>Pods: {podNodes.length}</span>
        </div>
        <div className="stat">
          <span className="stat-dot service-dot" />
          <span>Services: {serviceNodes.length}</span>
        </div>
        <div className="stat">
          <span className="stat-dot edge-dot" />
          <span>Connections: {edges.length}</span>
        </div>
      </div>

      {/* Graph canvas */}
      <div className="topology-graph-wrapper">
        <div ref={containerRef} className="topology-graph" />
        <div ref={toastRef} className="topology-toast" />
      </div>

      {/* Legend */}
      <div className="topology-legend">
        {/* Namespace legend */}
        <div className="legend-section">
          <div className="legend-title">Namespaces</div>
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

        {/* Node legend */}
        <div className="legend-section">
          <div className="legend-title">Cluster Nodes</div>
          {clusterNodes.map(n => (
            <div key={n.id} className="legend-item">
              <div
                className={`legend-color ${n.role === 'master' ? 'master-bg' : 'worker-bg'}`}
                style={{
                  backgroundColor: n.role === 'master' ? COLORS.master : COLORS.worker,
                }}
              />
              <span>
                {n.name}
                <span className="legend-ip"> {n.ip || ''}</span>
                <span className="legend-pod-count">
                  {' '}({podCountByNode[n.name] || 0} pods)
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Service legend */}
        <div className="legend-section">
          <div className="legend-title">Services</div>
          {serviceNodes.map(svc => (
            <div key={svc.id} className="legend-item">
              <div className="legend-color service-color" />
              <span>
                {svc.name}
                {svc.ip && <span className="legend-ip"> {svc.ip}</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Legend shapes */}
        <div className="legend-section">
          <div className="legend-title">Legend</div>
          <div className="legend-item">
            <div className="legend-shape cluster-master" />
            <span>Master Node</span>
          </div>
          <div className="legend-item">
            <div className="legend-shape cluster-worker" />
            <span>Worker Node</span>
          </div>
          <div className="legend-item">
            <div className="legend-shape pod-legend" />
            <span>Pod (with IP)</span>
          </div>
          <div className="legend-item">
            <div className="legend-shape service-legend" />
            <span>Service</span>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="topology-hint">
        💡 Click any element for details • Hover to highlight • Double-click to fit all
      </div>
    </div>
  )
}
