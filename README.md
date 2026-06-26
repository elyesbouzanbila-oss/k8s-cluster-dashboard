# Kubernetes Dashboard

Real-time Kubernetes cluster monitoring with interactive topology visualization, security auditing, and threat detection.

## Features

- **Network Tab**: Interactive topology graph showing pods, services, and cluster connections
- **Security Tab**: RBAC analysis and privileged pod detection  
- **Threats Tab**: Real-time threat streaming via WebSocket
- **Live Cluster Data**: Connected to your Kubernetes cluster at 192.168.3.20
- **Dark UI**: Modern, lightweight interface with namespace-based color coding

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Connected Kubernetes cluster (192.168.3.20:6443)
- Valid service account token in `backend/.env`

### Run
```bash
docker compose up --build
```

Visit: http://localhost:5173

### Services
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Redis: localhost:6379

## Configuration

### Backend (.env)
```env
K8S_MODE=token
K8S_SERVER=https://192.168.3.20:6443
K8S_TOKEN=<your-token>
API_KEY=your-secret-api-key-change-this
FRONTEND_URL=http://localhost:5173
REDIS_URL=redis://redis:6379/0
```

### Frontend (.env.local)
```env
VITE_API_URL=http://localhost:8000
VITE_API_KEY=your-secret-api-key-change-this
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/network/pods` | GET | List all pods across namespaces |
| `/api/network/topology` | GET | Cluster topology (nodes + edges) |
| `/api/security/rbac` | GET | RBAC bindings |
| `/api/security/privileged` | GET | Privileged pods |
| `/api/threats/falco` | POST | Send threat events (Falco webhook) |
| `/api/threats/ws/threats` | WebSocket | Real-time threat stream |

All endpoints require `X-API-Key` header.

## Architecture

```
Frontend (React + Vite)
    ↓ HTTP + X-API-Key
Backend (FastAPI + Python)
    ↓ Bearer Token
Kubernetes Cluster (192.168.3.20:6443)
```

## Project Structure

```
.
├── docker-compose.yml          # Service orchestration
├── backend/                    # FastAPI application
│   ├── main.py                # Entry point
│   ├── config.py              # Settings & credentials
│   ├── dependencies.py         # Auth middleware
│   ├── routers/               # API endpoints
│   ├── services/              # Business logic
│   ├── models/                # Data models
│   ├── connection/            # K8s cluster connection
│   └── requirements.txt        # Python dependencies
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── App.tsx            # Main component
│   │   ├── App.css            # Styling
│   │   ├── Topology.tsx       # Graph visualization
│   │   └── Topology.css       # Graph styling
│   ├── package.json           # Node dependencies
│   └── vite.config.ts         # Vite configuration
└── README.md                   # This file
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

## License

Internal project.
