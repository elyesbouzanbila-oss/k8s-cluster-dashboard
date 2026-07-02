import type { StorageData, DataSourceStatus } from '../types'
import { DataSourceBadge } from './DataSourceBadge'

interface StoragePanelProps {
  storageConfig: StorageData | null
  storageStatus?: DataSourceStatus
}

export function StoragePanel({ storageConfig, storageStatus }: StoragePanelProps) {
  return (
    <div className="section storage-section">
      <h2>Storage Configuration</h2>

      <div className="subsection">
        <div className="subsection-header">
          <h3>Storage Classes</h3>
          <DataSourceBadge status={storageStatus} label="Storage data" />
        </div>
        {!storageConfig || storageConfig.storageClasses.length === 0 ? (
          <p className="empty">No storage classes found.</p>
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
                    <td className="cell-mono">{sc.metadata.name}</td>
                    <td>{sc.provisioner}</td>
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
        <h3>Persistent Volume Claims (PVCs)</h3>
        {!storageConfig || storageConfig.persistentVolumeClaims.length === 0 ? (
          <p className="empty">No PVCs found.</p>
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
                {storageConfig.persistentVolumeClaims.map((pvc) => (
                  <tr key={pvc.metadata.uid}>
                    <td className="cell-mono">{pvc.metadata.name}</td>
                    <td>{pvc.metadata.namespace}</td>
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
      </div>
    </div>
  )
}
