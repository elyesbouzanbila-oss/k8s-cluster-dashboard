# Kubernetes Dashboard

Real-time Kubernetes cluster monitoring with interactive topology visualization, security auditing, threat detection, Prometheus-powered time-series metrics, and per-pod resource consumption monitoring.

## Features

- **Dashboard** — Cluster overview with pod counts, threat summaries, resource usage bars, and RBAC breakdown
- **Network** — Interactive topology graph showing cluster nodes, pods, services, and their connections
- **Security** — RBAC binding analysis with cluster-admin flagging, privileged pod and root-user detection
- **Threats** — Real-time threat event streaming via WebSocket (Falco webhook ingestion)
- **Metrics** — Node-level CPU/memory usage bars, per-pod resource consumption with container-level breakdown
- **Monitoring** — Time-series CPU and memory charts powered by Prometheus, with per-container drill-down
- **Storage** — StorageClass and PersistentVolumeClaim overview

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
| `/api/security/rbac`             | GET        | RBAC bindings                           |
| `/api/security/privileged`       | GET        | Privileged/root pods                    |
| `/api/threats/falco`             | POST       | Falco webhook — ingest threat events   |
| `/api/threats/ws/threats`        | WebSocket  | Real-time threat stream                |
| `/metrics/nodes`                 | GET        | Node CPU/memory usage                  |
| `/metrics/pods`                  | GET        | Per-pod resource consumption           |
| `/metrics/pods/{namespace}`      | GET        | Pod metrics for a specific namespace   |
| `/config/storage`                | GET        | StorageClass and PVC list              |
| `/api/prometheus/query`          | GET        | Arbitrary instant PromQL query         |
| `/api/prometheus/query-range`    | GET        | Arbitrary range PromQL query           |
| `/api/prometheus/namespace/cpu`  | GET        | Namespace-pod CPU time-series          |
| `/api/prometheus/namespace/memory` | GET      | Namespace-pod memory time-series       |
| `/api/prometheus/pod/cpu`        | GET        | Per-container CPU time-series          |
| `/api/prometheus/pod/memory`     | GET        | Per-container memory time-series       |

## Architecture

```
┌─────────────┐     HTTP + X-API-Key      ┌──────────────┐
│   Frontend  │ ──────────────────────────▶│   Backend    │
│ (React+Vite)│◀──────────────────────────│ (FastAPI)    │
└─────────────┘     JSON responses         └──────┬───────┘
                                                  │
                          ┌───────────────────────┼─────────┐
                          ▼                       ▼         ▼
                   ┌──────────────┐     ┌────────────┐  ┌────┐
                   │  Kubernetes  │     │ Prometheus │  │Redis│
                   │    API       │     │ (optional) │  └────┘
                   └──────────────┘     └────────────┘
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
│   ├── routers/                 # API endpoints by domain
│   ├── services/                # Business logic (K8s API calls, PromQL)
│   ├── models/                  # Pydantic models + mock data
│   ├── connection/              # K8s client factory (kubeconfig/token/incluster)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Main app with tab routing
│   │   ├── App.css              # Global dark-theme styles
│   │   ├── Topology.tsx         # Cytoscape.js topology graph
│   │   ├── components/          # Panel components per tab
│   │   └── types.ts             # TypeScript interfaces
│   ├── package.json
│   └── nginx.conf               # SPA proxy config for in-cluster deployment
├── k8s/                          # Kubernetes deployment manifests
│   ├── deploy-backend.yaml
│   ├── deploy-frontend.yaml
│   ├── deploy-redis.yaml
│   ├── svc-backend.yaml
│   ├── svc-frontend.yaml
│   ├── svc-redis.yaml
│   ├── namespace.yaml
│   ├── sa.yaml                  # ServiceAccount with cluster-reader role
│   ├── clusterrole.yaml
│   ├── clusterrolebinding.yaml
│   └── secret.yaml
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

- **Adding a new Prometheus chart** — add a new PromQL function in `backend/services/prometheus_service.py`, a route in `routers/prometheus.py`, and a chart card in `frontend/src/components/MonitoringPanel.tsx`
- **Adding a new data source** — create a new service + router in the backend following the existing patterns (K8s API client is injected via FastAPI dependency)
- **All data sources fall back to mock data** — add mock data to `models/mock_data.py` to keep the dashboard functional without a live cluster

## License

Internal project.
