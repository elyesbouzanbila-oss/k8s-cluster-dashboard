# CNI Command Center

A dedicated Calico CNI diagnostics and command center for Kubernetes clusters.
General cluster/resource monitoring (node CPU/mem, pod resources, storage) is handled by Grafana
(via kube-prometheus-stack). This app focuses exclusively on Calico CNI health, IPAM, network policy
inspection, topology, and connectivity diagnostics.

## Features

- **Dashboard** — CNI Command Center overview: Calico agent health, BGP peers, IPAM utilization, policy counts, Felix performance
- **CNI Health** — Per-node Felix and BIRD/BGP agent status cards with color-coded health indicators
- **IPAM** — IP pool utilization bars, block allocation statistics, pool definition tables
- **Policies** — Searchable/filterable Calico NetworkPolicy and GlobalNetworkPolicy table with Allow/Deny badges
- **Topology** — Interactive node-to-node BGP mesh + pod overlay topology graph
- **Diagnostics** — On-demand pod-to-pod / pod-to-service connectivity test runner
- **Threats** — Real-time network-scoped threat event streaming via WebSocket (Falco webhook ingestion)

> **Note:** General cluster monitoring (node CPU/memory, pod resource consumption, storage) has been moved to **Grafana** (see [Grafana Handoff](#grafana-handoff)).

## Grafana Handoff

General cluster/resource monitoring is handled by Grafana (via `kube-prometheus-stack`).
The CNI Command Center focuses exclusively on Calico diagnostics.

### Grafana Access

**Service:** `monitor-grafana.monitoring.svc.cluster.local` (typically `ClusterIP` by default)

**Expose Grafana externally** via NodePort:

```bash
# Check current Grafana service type
kubectl get svc -n monitoring monitor-grafana

# Patch to NodePort (if currently ClusterIP)
kubectl patch svc -n monitoring monitor-grafana -p '{"spec":{"type":"NodePort"}}'

# Get the assigned NodePort
kubectl get svc -n monitoring monitor-grafana -o jsonpath='{.spec.ports[0].nodePort}'
```

**Default credentials** (kube-prometheus-stack):
- Username: `admin`
- Password: `prom-operator`

If the password has been changed, retrieve it from the secret:
```bash
kubectl get secret -n monitoring monitor-grafana -o jsonpath="{.data.admin-password}" | base64 --decode
```

**URL:** `http://<node-ip>:<node-port>`

### Default Dashboards (kube-prometheus-stack)

The following dashboards are included by default with `kube-prometheus-stack` and fully replace the old Monitoring/Storage tabs:

| Dashboard | What it replaces |
|-----------|-----------------|
| **Kubernetes / Compute Resources / Node** | Node CPU/memory usage (was old Metrics tab) |
| **Kubernetes / Compute Resources / Pod** | Per-pod resource consumption with container drill-down |
| **Kubernetes / Compute Resources / Namespace** | Namespace-level CPU/memory aggregation |
| **Kubernetes / Networking** | Network traffic, dropped packets |
| **Kubernetes / Storage / PersistentVolumes** | PVC overview (was old Storage tab) |
| **Kubernetes / Kubelet** | Kubelet metrics, pod startup latency |

### Calico Felix Dashboard

For deeper Felix metrics beyond what the CNI Command Center surfaces, import the official
community dashboard:

| Field | Value |
|-------|-------|
| **Dashboard ID** | `12175` |
| **Title** | Calico Felix (Tigera) |
| **Source** | [grafana.com/grafana/dashboards/12175-calico-felix](https://grafana.com/grafana/dashboards/12175-calico-felix/) |

**Import steps:**
1. Open Grafana in your browser
2. Click **+** → **Import** (or go to Dashboards → New → Import)
3. Enter dashboard ID `12175`
4. Select the Prometheus data source (default: `Prometheus`)
5. Click **Import**

This dashboard provides:
- Per-node Felix endpoint counts for workloads and host endpoints
- iptables restore errors and dataplane failures over time
- BGP session status and peer counts per node
- Policy evaluation rates and latency
- Felix memory usage and goroutine counts

### Felix Metrics Scraping

Ensure Prometheus is scraping Felix metrics from calico-node (port `9091`):

```bash
# Verify Felix metrics are being scraped
kubectl get pod -n kube-system -l k8s-app=calico-node -o yaml | grep -i 9091

# Test query in Prometheus
# Open Prometheus: kubectl port-forward -n monitoring svc/monitor-kube-prometheus-st-prometheus 9090:9090
# Then query: felix_active_local_endpoints
```

If Felix metrics are not being scraped, add a `PodMonitor` or `ServiceMonitor` targeting
`calico-node` pods on port `9091` with label `k8s-app: calico-node`.

---

## RBAC Permissions

The dashboard requires the following ClusterRole permissions to operate. These are defined in
[`k8s/clusterrole.yaml`](k8s/clusterrole.yaml).

| API Group | Resources | Verbs | Purpose |
|-----------|-----------|-------|---------|
| `(core)` | `pods`, `services`, `nodes`, `endpoints`, `namespaces` | `get, list, watch` | Pod discovery, topology, diagnostics |
| `rbac.authorization.k8s.io` | `clusterrolebindings`, `rolebindings`, `clusterroles`, `roles` | `get, list` | RBAC audit (Security tab) |
| `(core)` | `serviceaccounts`, `secrets` | `get, list` | Security context enrichment |
| `metrics.k8s.io` | `pods`, `nodes` | `get, list, watch` | Resource usage panels (if metrics-server installed) |
| `storage.k8s.io` | `storageclasses` | `get, list` | Storage class discovery |
| `(core)` | `persistentvolumes`, `persistentvolumeclaims` | `get, list, watch` | PVC/PV overview |
| `networking.k8s.io` | `networkpolicies` | `get, list` | Kubernetes NetworkPolicy discovery |
| `crd.projectcalico.org` | `ippools`, `ipamblocks`, `ipamconfigs`, `bgppeers`, `bgpconfigurations`, `felixconfigurations`, `networkpolicies`, `globalnetworkpolicies`, `hostendpoints`, `clusterinformations` | `get, list, watch` | Calico CNI diagnostics — IPAM, BGP, policies, Felix |
| `(core)` | `pods` | `create, delete` | Ephemeral connectivity test pods (Diagnostics tab) |
| `(core)` | `pods/log` | `get` | Read diagnostic pod output |

> **Note:** The `pods` `create/delete` and `pods/log` `get` permissions are the only write/mutate
> permissions required. They are scoped cluster-wide for convenience but can be narrowed to a
> specific namespace via a `Role` + `RoleBinding` instead.

### Verify RBAC

```bash
kubectl auth can-i list ippools --as=system:serviceaccount:k8s-dashboard:dashboard-sa
kubectl auth can-i create pods --as=system:serviceaccount:k8s-dashboard:dashboard-sa
kubectl auth can-i get pods/log --as=system:serviceaccount:k8s-dashboard:dashboard-sa
```

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- A Kubernetes cluster (local, cloud, or on-prem)
- `kubectl` configured or a service account token with cluster-wide read permissions
- (Optional) Prometheus deployed for time-series monitoring charts
- (Optional) Falco + Falcosidekick for real-time threat ingestion

### Run
```bash
docker compose up --build
```

Visit: http://localhost:5173

### Services
| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:5173       |
| Backend  | http://localhost:8000       |
| Redis    | localhost:6379              |

## Configuration

The backend supports three modes for connecting to your Kubernetes cluster.

### Mode 1: kubeconfig (default, recommended for local dev)

Mount your kubeconfig into the backend container (already configured in `docker-compose.yml`):
```env
K8S_MODE=kubeconfig
```

### Mode 2: Token-based (for remote clusters)

```env
K8S_MODE=token
K8S_SERVER=https://<your-cluster>:6443
K8S_TOKEN=<your-service-account-token>
```

### Mode 3: In-cluster (when deployed inside Kubernetes)

```env
K8S_MODE=incluster
```

### Environment Variables

#### Backend (`.env`)
```env
API_KEY=your-secret-api-key-change-this
FRONTEND_URL=http://localhost:5173
REDIS_URL=redis://redis:6379/0

# K8s connection (pick one mode)
K8S_MODE=kubeconfig          # kubeconfig | token | incluster
K8S_SERVER=                  # Required for token mode
K8S_TOKEN=                   # Required for token mode

# Prometheus (optional — enables time-series charts)
PROMETHEUS_URL=http://prometheus-k8s.monitoring.svc:9090
```

#### Frontend (`.env.local`)
```env
VITE_API_URL=http://localhost:8000
VITE_API_KEY=your-secret-api-key-change-this
```

## API Endpoints

All endpoints require the `X-API-Key` header.

| Endpoint                         | Method     | Description                              |
|----------------------------------|------------|------------------------------------------|
| `/mock/pods`                     | GET        | Mock pod data                           |
| `/mock/topology`                 | GET        | Mock topology                           |
| `/api/network/pods`              | GET        | List all pods across namespaces         |
| `/api/network/topology`          | GET        | Cluster topology graph (nodes + edges)  |
| `/api/threats/falco`             | POST       | Falco webhook — ingest threat events   |
| `/api/threats/ws/threats`        | WebSocket  | Real-time threat stream                |
| `/api/cni/nodes`                 | GET        | Per-node Calico agent status           |
| `/api/cni/bgp-peers`             | GET        | BGP peer list + session state          |
| `/api/cni/ippools`               | GET        | IP pool definitions                    |
| `/api/cni/ipam/utilization`      | GET        | Allocated vs. free IPs per pool        |
| `/api/cni/policies`              | GET        | Calico NetworkPolicy + GlobalNetworkPolicy |
| `/api/cni/topology`              | GET        | BGP mesh + overlay topology            |
| `/api/cni/metrics/felix`         | GET        | Felix performance counters             |
| `/api/cni/diagnostics/connectivity` | POST    | On-demand connectivity test (Phase 4)  |

## Architecture

```
┌────────────────────┐     HTTP + X-API-Key      ┌──────────────────┐
│  CNI Command Center │ ──────────────────────────▶│   Backend        │
│  (React+Vite)      │◀──────────────────────────│ (FastAPI)        │
└────────────────────┘     JSON responses         └────────┬─────────┘
                                                          │
                         ┌───────────────────────────────┼──────────────┐
                         ▼                               ▼              ▼
                  ┌──────────────┐              ┌──────────────┐  ┌──────┐
                  │  Kubernetes  │              │  Prometheus  │  │Redis │
                  │  API (CRDs)  │              │ (Felix + k8s)│  └──────┘
                  └──────────────┘              └──────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  Calico CRDs │
                  │ (IPPool, BGP,│
                  │  IPAM, Pol.) │
                  └──────────────┘

📊 Cluster monitoring (node/pod resources, storage) → **Grafana** (separate, via kube-prometheus-stack)
```

All data sources have mock fallbacks — the dashboard works without a live cluster for development and evaluation.

## Project Structure

```
.
├── docker-compose.yml           # Service orchestration (frontend + backend + redis)
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── config.py                # Settings via Pydantic
│   ├── dependencies.py          # Auth middleware (X-API-Key)
│   ├── routers/
│   │   ├── cni.py               # CNI diagnostics (Calico CRDs, IPAM, BGP, Felix)
│   │   ├── network.py           # Pod discovery, topology
│   │   ├── threats.py           # Falco webhook + WebSocket
│   │   └── mock.py              # Mock fallback endpoints
│   ├── services/
│   │   ├── calico_service.py    # Calico CRD access (IPPool, BGP, IPAM, policies)
│   │   ├── felix_metrics_service.py # Felix PromQL via Prometheus
│   │   ├── network_service.py   # Pod & service discovery
│   │   ├── prometheus_service.py # PromQL query proxy
│   │   └── threat_service.py    # Redis pub/sub for Falco events
│   ├── models/
│   │   ├── cni_models.py        # CNI Pydantic schemas
│   │   ├── network.py           # Pod/topology models
│   │   ├── threat.py            # Falco event schema
│   │   └── mock_data.py         # Shared mock data (including CNI mocks)
│   ├── connection/              # K8s client factory (kubeconfig/token/in-cluster)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # CNI Command Center tab routing
│   │   ├── App.css              # Dark-theme styles + CNI panel styles
│   │   ├── Topology.tsx         # Cytoscape.js topology graph
│   │   ├── components/
│   │   │   ├── CniHealthPanel.tsx     # Per-node Felix/BIRD status cards
│   │   │   ├── IpamPanel.tsx          # IP pool utilization + block table
│   │   │   ├── PolicyInspectorPanel.tsx  # Searchable policy table
│   │   │   ├── CniTopologyPanel.tsx   # BGP mesh + overlay topology
│   │   │   ├── DiagnosticsPanel.tsx   # Connectivity test runner
│   │   │   ├── DashboardPanel.tsx     # CNI Command Center overview
│   │   │   ├── ThreatPanel.tsx        # Real-time threat stream
│   │   │   └── shared (DataSourceBadge, EmptyState, Icon, Skeleton, ErrorBoundary)
│   │   └── types.ts             # TypeScript interfaces (+ CNI types)
│   ├── package.json
│   └── nginx.conf               # SPA proxy config
├── k8s/                          # K8s deployment manifests
│   ├── deploy-backend.yaml      # Backend deployment + service
│   ├── deploy-frontend.yaml     # Frontend deployment + service
│   ├── deploy-redis.yaml        # Redis deployment + service
│   ├── namespace.yaml
│   ├── sa.yaml                  # ServiceAccount
│   ├── clusterrole.yaml         # RBAC: Calico CRDs, pods, network policies
│   ├── clusterrolebinding.yaml
│   └── secret.yaml              # API key secret
└── README.md
```

## Development

### Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Deploying to a Cluster
```bash
kubectl apply -k k8s/     # or: kubectl apply -f k8s/
```

## Extending

- **Adding a new CNI panel** — create a new service function in `backend/services/calico_service.py`, a route in `backend/routers/cni.py`, and a React component in `frontend/src/components/` following the existing patterns
- **Adding a new Prometheus chart** — add a new PromQL function in `backend/services/prometheus_service.py` and a chart card in the relevant frontend component
- **Adding a new data source** — create a new service + router in the backend following the existing patterns (K8s API client is injected via FastAPI dependency)
- **All data sources fall back to mock data** — add mock data to `models/mock_data.py` to keep the dashboard functional without a live cluster

## License

Internal project.

# CNI Command Center

![CI](https://github.com/elyesbouzanbila-oss/k8s-cluster-dash-boad/actions/workflows/ci.yml/badge.svg)

A dedicated Calico CNI diagnostics and command center for Kubernetes clusters.
General cluster/resource monitoring (node CPU/mem, pod resources, storage) is handled by Grafana
(via kube-prometheus-stack). This app focuses exclusively on Calico CNI health, IPAM, network policy
inspection, topology, and connectivity diagnostics.