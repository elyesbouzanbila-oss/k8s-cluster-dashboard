import { useState, useMemo } from 'react'
import type { StorageData, DataSourceStatus } from '../types'
import { DataSourceBadge } from './DataSourceBadge'
import { EmptyState } from './EmptyState'

interface StoragePanelProps {
  storageConfig: StorageData | null
  storageStatus?: DataSourceStatus
}

export function StoragePanel({ storageConfig, storageStatus }: StoragePanelProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredPVCs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q || !storageConfig) return storageConfig?.persistentVolumeClaims || []
    return storageConfig.persistentVolumeClaims.filter(pvc =>
      pvc.metadata.name.toLowerCase().includes(q) ||
      pvc.metadata.namespace.toLowerCase().includes(q) ||
      pvc.status.phase.toLowerCase().includes(q)
    )
  }, [storageConfig, searchQuery])

  return (
    <div className="section storage-section">
      <h2>Storage Configuration</h2>

      <div className="subsection">
        <div className="subsection-header">
          <h3>Storage Classes</h3>
          <DataSourceBadge status={storageStatus} label="Storage data" />
        </div>
        {!storageConfig || storageConfig.storageClasses.length === 0 ? (
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            }
            message="No storage classes found"
            submessage="Ensure your cluster has storage classes configured."
          />
        ) : (
          <div className="storage-table-wrapper">
            <table className="storage-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Provisioner</th>
                  <th>Default</th>
                </tr>
              </thead>
              <tbody>
                {storageConfig.storageClasses.map((sc) => (
                  <tr key={sc.metadata.name}>
                    <td className="cell-mono" title={sc.metadata.name}>{sc.metadata.name}</td>
                    <td title={sc.provisioner}>{sc.provisioner}</td>
                    <td>
                      {sc.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true' ? (
                        <span className="badge badge-success">Yes</span>
                      ) : (
                        <span className="badge badge-muted">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="subsection">
        <div className="subsection-header">
          <h3>Persistent Volume Claims ({filteredPVCs.length})</h3>
          <DataSourceBadge status={storageStatus} label="Storage data" />
        </div>
        {!storageConfig || storageConfig.persistentVolumeClaims.length === 0 ? (
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            }
            message="No PVCs found"
          />
        ) : (
          <>
            {storageConfig.persistentVolumeClaims.length > 5 && (
              <div className="security-toolbar" style={{ marginBottom: '14px' }}>
                <div className="security-search">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="security-search-icon">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    className="security-search-input"
                    placeholder="Search PVCs by name, namespace, status..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    aria-label="Search PVCs"
                  />
                  {searchQuery && (
                    <button
                      className="security-search-clear"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
            {filteredPVCs.length === 0 ? (
              <EmptyState
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                }
                message="No matching PVCs"
                submessage="Try adjusting your search."
              />
            ) : (
              <div className="storage-table-wrapper">
                <table className="storage-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Namespace</th>
                      <th>Status</th>
                      <th>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPVCs.map((pvc) => (
                      <tr key={pvc.metadata.uid}>
                        <td className="cell-mono" title={pvc.metadata.name}>{pvc.metadata.name}</td>
                        <td title={pvc.metadata.namespace}>{pvc.metadata.namespace}</td>
                        <td>
                          <span className={`badge ${pvc.status.phase === 'Bound' ? 'badge-success' : 'badge-warning'}`}>
                            {pvc.status.phase}
                          </span>
                        </td>
                        <td>{pvc.spec.resources.requests.storage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
