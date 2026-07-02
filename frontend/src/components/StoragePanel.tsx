import { useState, useMemo } from 'react'
import type { StorageData, DataSourceStatus } from '../types'
import { DataSourceBadge } from './DataSourceBadge'
import { EmptyState } from './EmptyState'
import { Skeleton } from './Skeleton'
import { Icon } from './Icon'

interface StoragePanelProps {
  storageConfig: StorageData | null
  storageStatus?: DataSourceStatus
  loading?: boolean
}

export function StoragePanel({ storageConfig, storageStatus, loading }: StoragePanelProps) {
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

  const showSearch = storageConfig && storageConfig.persistentVolumeClaims.length > 5

  return (
    <div className="section storage-section">
      <h2>Storage Configuration</h2>

      <div className="subsection">
        <div className="subsection-header">
          <h3>Storage Classes</h3>
          <DataSourceBadge status={storageStatus} label="Storage data" />
        </div>
        {loading ? (
          <Skeleton variant="table-row" count={3} />
        ) : !storageConfig || storageConfig.storageClasses.length === 0 ? (
          <EmptyState
            icon={<Icon name="hard-drive" size={48} />}
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
        {loading ? (
          <Skeleton variant="table-row" count={4} />
        ) : !storageConfig || storageConfig.persistentVolumeClaims.length === 0 ? (
          <EmptyState
            icon={<Icon name="box" size={48} />}
            message="No PVCs found"
          />
        ) : (
          <>
            {showSearch && (
              <div className="security-toolbar" style={{ marginBottom: '14px' }}>
                <div className="security-search">
                  <Icon name="search" className="security-search-icon" />
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
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}
            {filteredPVCs.length === 0 ? (
              <EmptyState
                icon={<Icon name="search" size={48} />}
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
