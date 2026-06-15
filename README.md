# K8s Dashboard — Kubernetes Security & Network Monitor

A full-stack dashboard for monitoring the network topology, internal properties (IPs, ports), security posture, and runtime threats of any Kubernetes cluster — with a pluggable AI layer for intelligent analysis and anomaly detection.

---

## Features

- **Network topology** — force-directed graph of pods, services, and their connections with live flow overlay
- **Ports & IPs inventory** — complete matrix of every pod/service/node IP and port in the cluster, with exposure heatmap and risk flagging
- **Security posture** — RBAC explorer, privileged pod scanner, NetworkPolicy gap detection
- **Runtime threats** — live Falco event feed over WebSocket, severity timeline, rule breakdown
- **AI assistant** — chat with your cluster ("Why is pod X unreachable?"), automated risk scoring, anomaly detection (swappable between Claude, OpenAI, or a local Ollama model)

---

## Tech Stack

### Backend (Python)

| Package | Purpose |
|---|---|
| `fastapi` | REST API + WebSocket server |
| `uvicorn` | ASGI server |
| `kubernetes-asyncio` | Async Kubernetes API client |
| `httpx` | Async HTTP calls to AI providers |
| `pydantic` | Request/response schemas |
| `python-dotenv` | Environment variable loading |
| `scikit-learn` | IsolationForest anomaly detection |
| `redis` | WebSocket fan-out for Falco events |

### Frontend (React)

| Package | Purpose |
|---|---|
| `react` 18 | UI framework |
| `vite` | Build tool and dev server |
| `@tanstack/react-query` | Data fetching, caching, polling |
| `react-force-graph` | Pod/service topology graph |
| `recharts` | Threat timeline and exposure charts |
| `tailwindcss` | Utility-first styling with dark mode |
| `shadcn/ui` | Tables, badges, dialogs, tabs |
| `zustand` | Cluster connection and filter state |

### Data Sources

| Tool | What it provides |
|---|---|
| Kubernetes API server | Pods, services, nodes, RBAC, events |
| Cilium / Hubble | eBPF network flows and port-level visibility |
| Falco | Runtime syscall-level threat events via webhook |
| Prometheus | Bandwidth, latency, and error rate metrics |

### AI Layer

| Provider | Notes |
|---|---|
| Claude API | Default — chat, risk scoring, anomaly explanation |
| OpenAI | Drop-in swap via `AI_PROVIDER` env var |
| Ollama | Local model for air-gapped clusters |

### DevOps

| Tool | Purpose |
|---|---|
| Docker + Compose | Local dev stack (`docker compose up`) |
| Helm | Deploy the dashboard into a cluster |
| Redis | Pub-sub for WebSocket live streaming |
| kind / minikube | Local cluster for development and testing |

---

## Project Structure

```
k8s-dashboard/
│
├── backend/
│   ├── main.py                      # FastAPI app, CORS, router registration
│   ├── config.py                    # Settings via pydantic-settings
│   ├── dependencies.py              # get_k8s_client() Depends factory
│   │
│   ├── connection/
│   │   ├── factory.py               # kubeconfig / token / in-cluster switcher
│   │   └── models.py                # ConnectionConfig schema
│   │
│   ├── routers/
│   │   ├── network.py               # GET /network/topology, /network/ports-ips
│   │   ├── security.py              # GET /security/rbac, /security/privileged
│   │   ├── threats.py               # GET /threats/events, WS /ws/threats
│   │   └── ai.py                    # POST /ai/ask, /ai/analyze, /ai/score
│   │
│   ├── services/
│   │   ├── network_service.py       # Pod/svc/node IP+port aggregation
│   │   ├── security_service.py      # RBAC, privileged pod, secrets scanning
│   │   ├── threat_service.py        # Falco webhook intake + Redis pub-sub
│   │   └── ai_service.py            # AI provider abstraction
│   │
│   ├── ai/
│   │   ├── provider.py              # ask_ai() with AI_PROVIDER env switch
│   │   ├── context_builder.py       # Assembles cluster snapshot for prompts
│   │   └── prompts.py               # System prompts per AI feature
│   │
│   ├── models/
│   │   ├── network.py               # PodNetwork, ServiceNetwork, NodeNetwork
│   │   ├── security.py              # RbacBinding, PrivilegedPod, SecretRisk
│   │   ├── threat.py                # FalcoEvent, ThreatSeverity
│   │   └── ai.py                    # AiRequest, AiResponse, RiskScore
│   │
│   ├── tests/
│   │   ├── test_network.py
│   │   ├── test_security.py
│   │   └── test_ai.py
│   │
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   │
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       │
│       ├── store/
│       │   ├── connectionStore.ts   # Cluster connection state
│       │   └── filterStore.ts       # Namespace/pod filters
│       │
│       ├── api/
│       │   ├── client.ts            # Axios instance + base URL
│       │   ├── network.ts           # useNetworkTopology(), usePortsAndIPs()
│       │   ├── security.ts          # useRbac(), usePrivilegedPods()
│       │   ├── threats.ts           # useThreatEvents(), useThreatsSocket()
│       │   └── ai.ts                # useAskAI(), useRiskScore()
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── Header.tsx
│       │   │   └── ConnectClusterModal.tsx
│       │   ├── network/
│       │   │   ├── TopologyGraph.tsx
│       │   │   ├── PortsIPsTable.tsx
│       │   │   ├── ExposureHeatmap.tsx
│       │   │   └── NetworkPolicyBadge.tsx
│       │   ├── security/
│       │   │   ├── RbacExplorer.tsx
│       │   │   ├── PrivilegedPodsList.tsx
│       │   │   └── PolicyGapWarning.tsx
│       │   ├── threats/
│       │   │   ├── LiveFeed.tsx
│       │   │   ├── SeverityTimeline.tsx
│       │   │   └── RuleBreakdown.tsx
│       │   └── ai/
│       │       ├── AiChatPanel.tsx
│       │       ├── RiskScoreCard.tsx
│       │       └── AnomalyBanner.tsx
│       │
│       ├── pages/
│       │   ├── NetworkPage.tsx
│       │   ├── SecurityPage.tsx
│       │   ├── ThreatsPage.tsx
│       │   └── AiPage.tsx
│       │
│       └── lib/
│           ├── riskColors.ts        # Port risk color mapping
│           └── formatters.ts        # IP/port/date helpers
│
├── helm/
│   └── k8s-dashboard/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│           ├── deployment.yaml
│           ├── service.yaml
│           ├── serviceaccount.yaml
│           └── clusterrolebinding.yaml
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites

- Docker and Docker Compose
- A running Kubernetes cluster (local or remote)
- One of: a kubeconfig file, a service account token, or in-cluster deployment

### 1. Clone and configure

```bash
git clone https://github.com/your-org/k8s-dashboard.git
cd k8s-dashboard
cp .env.example .env
```

Edit `.env`:

```env
# AI provider — "claude" | "openai" | "ollama"
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...

# Optional — only needed for OpenAI
OPENAI_API_KEY=sk-...

# Optional — Ollama local endpoint
OLLAMA_HOST=http://localhost:11434
```

### 2. Run locally with Docker Compose

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

### 3. Connect your cluster

On first launch the dashboard shows a connection modal. Choose one of three modes:

**kubeconfig upload** — paste or upload your `~/.kube/config` file directly in the UI.

**API token** — provide your cluster's API server URL and a bearer token (e.g. from a ServiceAccount).

**In-cluster** — deploy the dashboard into your cluster via Helm and it auto-detects credentials from the mounted ServiceAccount.

### 4. Deploy into a cluster (optional)

```bash
helm install k8s-dashboard ./helm/k8s-dashboard \
  --set ai.provider=claude \
  --set ai.anthropicApiKey=sk-ant-... \
  --namespace monitoring --create-namespace
```

---

## Falco Integration

Point Falco's HTTP output at the backend webhook to stream runtime threats in real time:

```yaml
# In your falco.yaml
json_output: true
http_output:
  enabled: true
  url: "http://k8s-dashboard-backend/api/threats/falco"
```

Events are received, stored in Redis, and broadcast over `/ws/threats` to all connected dashboard clients.

---

## AI Features

All AI features share a single provider abstraction. Swap the model by changing one environment variable — no code changes required.

### Chat assistant

Ask natural-language questions about your cluster. The backend assembles a cluster snapshot (pods, IPs, ports, recent events) and injects it as context into the prompt before calling the AI provider.

Example questions:
- "Why is pod `nginx-7d8f` not reachable from `api-gateway`?"
- "Are there any ports open to 0.0.0.0 that shouldn't be?"
- "Which service accounts have cluster-admin binding?"

### Risk scoring

Sends each pod's configuration snapshot to the AI and receives a structured JSON risk score with specific remediation suggestions. Displayed as a sortable table per namespace.

### Anomaly detection

Collects a 24-hour baseline of normal port and traffic patterns using `scikit-learn`'s `IsolationForest`. Deviations are surfaced automatically as anomaly banners in the UI, with an optional LLM explanation of why the traffic pattern is unusual.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/network/topology` | Pod/service graph nodes and edges |
| GET | `/api/network/ports-ips` | All IPs and ports across pods, services, nodes |
| GET | `/api/security/rbac` | ClusterRole bindings summary |
| GET | `/api/security/privileged` | Pods running as root or privileged |
| GET | `/api/threats/events` | Recent Kubernetes warning events |
| POST | `/api/threats/falco` | Falco webhook receiver |
| WS | `/ws/threats` | Live threat event stream |
| POST | `/api/ai/ask` | Ask a question with cluster context |
| POST | `/api/ai/score` | Get risk scores for all pods |
| POST | `/api/ai/analyze` | Anomaly analysis for a traffic snapshot |

Full interactive docs available at `/docs` when the backend is running.

---

## Development

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Run tests:

```bash
pytest tests/ -v
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Run tests:

```bash
npm run test
```

### Local cluster with kind

```bash
kind create cluster --name k8s-dashboard-dev
kubectl cluster-info --context kind-k8s-dashboard-dev
```

---

## Roadmap

- [ ] Multi-cluster support (switch between clusters from the UI)
- [ ] Historical port/IP snapshots with diff view
- [ ] AI-generated NetworkPolicy suggestions based on observed traffic
- [ ] Slack / PagerDuty alert integration
- [ ] SBOM and image vulnerability panel (Trivy integration)
- [ ] CIS Kubernetes benchmark scoring via kube-bench

---

## License

MIT
