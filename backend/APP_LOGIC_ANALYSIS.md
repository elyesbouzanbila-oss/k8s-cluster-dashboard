# K8s Dashboard API - App Logic Analysis

## Overview
This is a Kubernetes cluster monitoring and security dashboard backend built with FastAPI, designed to display network topology, security configurations, and threat detection using Falco integration.

---

## Architecture

### Tech Stack
- **Framework**: FastAPI (async)
- **K8s Client**: `kubernetes_asyncio` (async Python K8s client)
- **Real-time**: Redis pub/sub for Falco events + WebSocket for live updates
- **Configuration**: Pydantic v2 with environment variables
- **AI Integration**: Support for Claude, OpenAI, or Ollama (configured but not actively used in routers)

### Service Structure
```
backend/
├── main.py                 # FastAPI app entry point
├── config.py              # Settings (AI provider, Redis URL)
├── dependencies.py        # FastAPI dependency injection
├── connection/            # K8s cluster connection logic
│   ├── factory.py        # Create K8s API clients (kubeconfig/token/incluster modes)
│   └── models.py         # ConnectionConfig Pydantic model
├── routers/              # API endpoints
│   ├── network.py        # Pod & topology endpoints
│   ├── security.py       # RBAC & privileged pod detection
│   └── threats.py        # Falco webhook + WebSocket stream
├── services/             # Business logic
│   ├── network_service.py
│   ├── security_service.py
│   └── threat_service.py
└── models/               # Pydantic data models
    ├── network.py
    ├── security.py
    └── threat.py
```

---

## API Endpoints

### **1. Health Check**
```
GET /
```
**Returns**: `{"status": "ok", "message": "K8s Dashboard API is running"}`

---

### **2. Network Endpoints** (`/api/network`)

#### `GET /api/network/pods`
**Purpose**: List all pods across all namespaces
**Query Params**: Accepts `ConnectionConfig` via query params (optional for incluster mode)
**Returns**: 
```json
[
  {
    "name": "pod-name",
    "namespace": "default",
    "pod_ip": "10.0.0.5",
    "node_name": "node-1",
    "phase": "Running",
    "labels": {"app": "api"},
    "containers": [{"name": "main", "image": "myapp:1.0"}]
  }
]
```

#### `GET /api/network/topology`
**Purpose**: Get K8s cluster topology (nodes + edges)
**Returns**:
```json
{
  "nodes": [
    {
      "id": "svc:default/api-service",
      "type": "service",
      "namespace": "default",
      "name": "api-service",
      "ip": null
    },
    {
      "id": "pod:default/api-pod",
      "type": "pod",
      "namespace": "default",
      "name": "api-pod",
      "ip": "10.0.0.5"
    }
  ],
  "edges": []  # Currently empty; network flow detection would populate this
}
```

---

### **3. Security Endpoints** (`/api/security`)

#### `GET /api/security/rbac`
**Purpose**: List RBAC bindings (ClusterRoleBinding + RoleBinding)
**Returns**:
```json
[
  {
    "name": "admin-binding",
    "namespace": "default",
    "subjects": [
      {"kind": "User", "name": "admin", "namespace": null}
    ],
    "role_ref": {
      "kind": "ClusterRole",
      "name": "admin",
      "api_group": "rbac.authorization.k8s.io"
    },
    "binding_type": "ClusterRoleBinding"
  }
]
```

#### `GET /api/security/privileged`
**Purpose**: List pods running with privileged or root security contexts
**Returns**:
```json
[
  {
    "name": "privileged-pod",
    "namespace": "kube-system",
    "container": "system-container",
    "image": "ubuntu:22.04",
    "privileged": true,
    "run_as_user": 0
  }
]
```

---

### **4. Threat Detection Endpoints** (`/api/threats`)

#### `POST /api/threats/falco`
**Purpose**: Webhook endpoint to receive Falco security events
**Body**:
```json
{
  "output": "Suspicious process execution detected",
  "priority": "Warning",
  "rule": "Suspicious_Process_Execution",
  "time": "2024-01-15T10:30:00Z",
  "output_fields": {
    "process_name": "curl",
    "user": "root"
  }
}
```
**Returns**: `{"status": "ok"}`
**Behavior**: Publishes event to Redis channel `falco:events` for real-time subscribers

#### `WebSocket /api/threats/ws/threats`
**Purpose**: Real-time threat event stream via WebSocket
**Protocol**: 
1. Client connects to WebSocket
2. Backend subscribes to Redis channel `falco:events`
3. When Falco events arrive via POST webhook, they are broadcast to all connected WebSocket clients
4. Clients receive events as JSON strings in real-time

**Example Flow**:
```
Client1 connects → subscribed to Redis
Falco webhook → POST to /api/threats/falco → Redis publish
Client1 receives event via WebSocket → real-time alert
```

---

## Key Components

### **1. Dependency Injection (dependencies.py)**

#### `get_k8s_client(connection: ConnectionConfig)`
- Creates an async Kubernetes API client
- Automatically handles cleanup after use (generator pattern)
- Raises 500 HTTPException if connection fails
- Used by all K8s endpoints

#### `get_settings_dep()`
- Returns configuration from environment

### **2. Connection Management (connection/factory.py)**

Supports **three K8s connection modes**:

**a) Incluster Mode**
- Uses mounted ServiceAccount credentials
- Ideal for pods running inside K8s

**b) Kubeconfig Mode**
- Accepts kubeconfig file path OR raw YAML
- Falls back to `~/.kube/config`

**c) Token Mode**
- Uses explicit server URL + bearer token
- Optional CA certificate for HTTPS verification

### **3. Service Layer**

#### `network_service.py`
- `get_pods()`: Fetches all pods with metadata, IP, containers
- `get_topology()`: Builds node graph (pods + services) for visualization

#### `security_service.py`
- `get_rbac()`: Aggregates ClusterRoleBindings and RoleBindings
- `get_privileged_pods()`: Identifies security risks (privileged=true, runAsUser=0)

#### `threat_service.py`
- `publish_falco_event()`: Publishes events to Redis
- `subscribe_events()`: Creates Redis pub/sub listener

### **4. Configuration (config.py)**

```python
AI_PROVIDER: str = "claude"  # Claude, OpenAI, or Ollama
ANTHROPIC_API_KEY: Optional[str]  # For Claude
OPENAI_API_KEY: Optional[str]      # For OpenAI
OLLAMA_HOST: Optional[str]         # For Ollama
REDIS_URL: str = "redis://redis:6379/0"
```

**Note**: AI provider settings are loaded but not actively used in current routers.

---

## Data Flow

### **Network Discovery Flow**
```
GET /api/network/pods
  ↓
depends_on: get_k8s_client (creates ApiClient from ConnectionConfig)
  ↓
network_service.get_pods()
  ↓
CoreV1Api.list_pod_for_all_namespaces()
  ↓
Transform K8s Pod objects → PodNetwork Pydantic models
  ↓
Return JSON response
```

### **Security Audit Flow**
```
GET /api/security/rbac
  ↓
security_service.get_rbac()
  ↓
RbacAuthorizationV1Api.list_cluster_role_binding() + list_role_binding_for_all_namespaces()
  ↓
Parse subjects + role_ref → RbacBinding models
  ↓
Return JSON
```

### **Real-time Threat Detection Flow**
```
[Falco Agent in K8s] 
  ↓ (HTTP POST webhook)
POST /api/threats/falco (FalcoEvent JSON)
  ↓
ThreatService.publish_falco_event()
  ↓
Redis.publish("falco:events", event_json)
  ↓
WebSocket clients subscribed to /api/threats/ws/threats receive event
```

---

## Middleware & CORS

**CORS Configuration** (main.py):
```python
CORSMiddleware(
    allow_origins=["*"],        # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],        # Allow all HTTP methods
    allow_headers=["*"],        # Allow all headers
)
```

⚠️ **Security Note**: `allow_origins=["*"]` is permissive. In production, restrict to specific frontend domain.

---

## Import Issues (Fixed)

### **Problem**: Relative imports failed in original code
- `main.py`: `from .routers import network` → Changed to `from routers import network`
- Router files used `..connection`, `..dependencies` → Changed to absolute imports
- Factory used `from .models` → Changed to `from connection.models`

### **Solution**: Converted to absolute imports + added `__init__.py` files to make all directories proper packages

---

## Current Limitations & TODOs

1. **Empty Network Edges**: Topology returns empty edges. Network flow detection (Cilium/eBPF) would populate these.

2. **AI Integration Unused**: Claude/OpenAI/Ollama settings loaded but not integrated into routers. Potential uses:
   - Anomaly detection analysis
   - Threat severity classification
   - RBAC policy recommendations

3. **No Authentication**: All endpoints open. Should add:
   - API key validation
   - JWT token verification
   - Role-based access control

4. **No Caching**: Every request queries K8s API. Should cache with TTL.

5. **Falco Integration One-way**: Only receives webhook, doesn't query Falco for historical events.

6. **Error Handling**: Generic 500 errors. Should add field-level error responses.

---

## Environment Variables (.env)

```
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OLLAMA_HOST=http://ollama:11434
REDIS_URL=redis://redis:6379/0
```

---

## Docker Compose Setup

- **Backend**: Python 3.11-slim, exposes :8000
- **Frontend**: Node 18-alpine (Vite), exposes :5173
- **Redis**: Alpine, exposes :6379
- **Backend volumes**: `/app` for hot reload (dev mode)

---

## Testing Endpoints

### Health Check
```bash
curl http://localhost:8000/
```

### List Pods (requires K8s access)
```bash
curl http://localhost:8000/api/network/pods
```

### Get Topology
```bash
curl http://localhost:8000/api/network/topology
```

### List RBAC
```bash
curl http://localhost:8000/api/security/rbac
```

### Privileged Pods
```bash
curl http://localhost:8000/api/security/privileged
```

### Send Falco Event
```bash
curl -X POST http://localhost:8000/api/threats/falco \
  -H "Content-Type: application/json" \
  -d '{
    "output": "Test threat",
    "priority": "Warning",
    "rule": "Test_Rule",
    "time": "2024-01-15T10:30:00Z",
    "output_fields": {}
  }'
```

### WebSocket Threats
```bash
wscat -c ws://localhost:8000/api/threats/ws/threats
```

---

## Summary

**Purpose**: Real-time Kubernetes cluster monitoring with:
- ✅ Pod & topology visualization
- ✅ RBAC audit & privileged pod detection
- ✅ Falco threat streaming (webhook + WebSocket)
- ⚠️ AI integration (configured but unused)

**Architecture**: Async FastAPI + kubernetes_asyncio + Redis pub/sub

**Status**: Functional for basic K8s visibility and threat detection; ready for production hardening (auth, caching, error handling).
