# Mock Kubernetes Testing (Without Real K8s Cluster)

Complete end-to-end testing using mock data - no Kubernetes required!

## Overview

Since you don't have a K8s cluster yet, you can:
1. **Test backend** with mock K8s data
2. **Test frontend** with mock responses
3. **Test integration** between frontend and backend
4. **Send real threat events** and verify streaming
5. **Verify all features work** before connecting real cluster

## Approach: Backend Mock Server

Create a mock K8s API server that mimics Kubernetes responses.

### Option A: Use Backend Test Fixtures (Easiest - 5 min)

The backend already has realistic mock data!

#### Step 1: Create Mock Endpoints

Create a new file `backend/mock_k8s_api.py`:

```python
"""Mock Kubernetes API for testing without real cluster"""

from fastapi import APIRouter, Depends
from test_fixtures import MockPodFixtures, MockServiceFixtures, MockRBACFixtures, MockSecurityFixtures
from dependencies import verify_api_key
from config import Settings

router = APIRouter(prefix="/mock", tags=["mock"])

@router.get("/mock/pods")
async def mock_pods(settings: Settings = Depends(verify_api_key)):
    """Return mock pods (same as real pods endpoint)"""
    pods = MockPodFixtures.get_pods()
    return {"items": [
        {
            "name": p["name"],
            "namespace": p["namespace"],
            "pod_ip": p["pod_ip"],
            "node_name": p["node_name"],
            "phase": p["phase"],
            "labels": p["labels"],
            "containers": p["containers"]
        } for p in pods
    ]}

@router.get("/mock/topology")
async def mock_topology(settings: Settings = Depends(verify_api_key)):
    """Return mock topology"""
    pods = MockPodFixtures.get_pods()
    services = MockServiceFixtures.get_services()
    
    nodes = []
    for s in services:
        nodes.append({
            "id": f"svc:{s['namespace']}/{s['name']}",
            "type": "service",
            "namespace": s['namespace'],
            "name": s['name']
        })
    for p in pods:
        nodes.append({
            "id": f"pod:{p['namespace']}/{p['name']}",
            "type": "pod",
            "namespace": p['namespace'],
            "name": p['name'],
            "ip": p['pod_ip']
        })
    
    return {"nodes": nodes, "edges": []}

@router.get("/mock/rbac")
async def mock_rbac(settings: Settings = Depends(verify_api_key)):
    """Return mock RBAC bindings"""
    return MockRBACFixtures.get_rbac_bindings()

@router.get("/mock/privileged")
async def mock_privileged(settings: Settings = Depends(verify_api_key)):
    """Return mock privileged pods"""
    return MockSecurityFixtures.get_privileged_pods()
```

#### Step 2: Register Endpoints in Backend

Add to `backend/main.py`:

```python
from routers import mock_k8s_api

app.include_router(mock_k8s_api.router)
```

#### Step 3: Test Mock Endpoints

```powershell
# Test mock pods
Invoke-WebRequest http://localhost:8000/mock/pods `
    -Headers @{"X-API-Key"="your-secret-api-key-change-this"} `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | Select-Object -First 1

# Test mock topology
Invoke-WebRequest http://localhost:8000/mock/topology `
    -Headers @{"X-API-Key"="your-secret-api-key-change-this"} `
    -UseBasicParsing
```

---

## Option B: Docker-based Test Environment (Recommended - 10 min)

Use Docker to simulate K8s without actual cluster.

### Setup

Create `docker-compose.test.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - API_KEY=your-secret-api-key-change-this
      - FRONTEND_URL=http://localhost:5173
      - REDIS_URL=redis://redis:6379/0
      - MOCK_K8S=true
    depends_on:
      - redis

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:8000
      - VITE_API_KEY=your-secret-api-key-change-this
    depends_on:
      - backend

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

### Run

```bash
docker compose -f docker-compose.test.yml up --build
```

Access:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Redis: localhost:6379

---

## Complete Testing Without K8s

### 1. Test Network Tab (with mock data)

```bash
# Backend serves mock pods
# Frontend calls /api/network/pods
# Frontend displays mock data
```

Expected: See 4 realistic pods (api-server, database, prometheus, redis)

### 2. Test Security Tab (with mock data)

```bash
# Backend serves mock RBAC
# Frontend displays bindings with admin badges
# High-risk pods highlighted
```

Expected: See RBAC bindings, some flagged as admin, privileged pods warning

### 3. Test Threats Tab (with real events)

```powershell
# Send REAL threat events
# Frontend receives via WebSocket
# Events appear in real-time
```

Send multiple test threats:

```powershell
$threats = @(
    @{output="Critical threat";priority="Critical";rule="CriticalRule"},
    @{output="High severity";priority="High";rule="HighRule"},
    @{output="Medium alert";priority="Medium";rule="MediumRule"}
)

foreach ($threat in $threats) {
    $body = @{
        output = $threat.output
        priority = $threat.priority
        rule = $threat.rule
        time = (Get-Date -AsUTC).ToString("o")
        output_fields = @{}
    } | ConvertTo-Json
    
    Invoke-WebRequest -Uri "http://localhost:8000/api/threats/falco" `
        -Method POST `
        -Headers @{"X-API-Key"="your-secret-api-key-change-this";"Content-Type"="application/json"} `
        -Body $body -UseBasicParsing
    
    Start-Sleep -Seconds 1
}
```

Watch frontend - threats appear in real-time with color-coding!

### 4. Full Integration Test

```bash
# 1. Open frontend: http://localhost:5173

# 2. Network tab:
#    - See mock pods
#    - See topology
#    - All data visible

# 3. Security tab:
#    - See RBAC bindings
#    - See privileged pods
#    - Warnings highlighted

# 4. Threats tab:
#    - Connection shows "Threats Live"
#    - Send test events
#    - See them appear immediately
#    - Verify color-coding
```

---

## Testing Scenarios

### Scenario 1: Verify API Works

```powershell
# Test each endpoint
@("pods", "topology", "rbac", "privileged") | ForEach-Object {
    $endpoint = $_
    Write-Host "Testing /api/network/$endpoint"
    Invoke-WebRequest "http://localhost:8000/api/network/$endpoint" `
        -Headers @{"X-API-Key"="your-secret-api-key-change-this"} `
        -UseBasicParsing | Select-Object StatusCode
}
```

All should return 200 OK.

### Scenario 2: Verify Frontend Works

```
1. Open http://localhost:5173
2. Check each tab loads
3. Verify data displays
4. No console errors
```

### Scenario 3: Verify WebSocket Works

```
1. Open http://localhost:5173
2. Go to Threats tab
3. Check status shows "Threats Live"
4. Send test event
5. See event appear immediately
6. Refresh page - reconnects automatically
```

### Scenario 4: Verify Authentication

```powershell
# Without API key
try { 
    Invoke-WebRequest http://localhost:8000/api/network/pods -UseBasicParsing 
} catch { 
    Write-Host "✓ 401 Unauthorized (expected)" 
}

# With wrong key
try { 
    Invoke-WebRequest http://localhost:8000/api/network/pods `
        -Headers @{"X-API-Key"="wrong"} -UseBasicParsing 
} catch { 
    Write-Host "✓ 403 Forbidden (expected)" 
}
```

---

## Test Data Summary

### Pods (4 examples)
- `api-server-prod-1` (production, multi-container)
- `database-backup` (production, backup job)
- `prometheus-0` (monitoring)
- `redis-cache` (production)

### Services (4 examples)
- `api-service` (LoadBalancer, public)
- `database-service` (ClusterIP, internal)
- `prometheus` (ClusterIP)
- `kubernetes` (ClusterIP, default)

### RBAC (5 examples)
- `admin-cluster-binding` (cluster-admin for admins)
- `developers-edit-binding` (edit for developers)
- `contractor` (⚠️ cluster-admin for external user)
- System service account bindings
- High-risk contractor access detected

### Threats (5 examples)
- Suspicious process execution (Warning)
- Privilege escalation (Critical)
- Unauthorized process (High)
- Sensitive file access (Warning)
- Network anomaly (Medium)

---

## Verification Checklist

✅ **Backend**
- [ ] Health check: `curl http://localhost:8000/` → 200 OK
- [ ] API key enforced: No key → 401, wrong key → 403
- [ ] Mock pods: `curl http://localhost:8000/api/network/pods -H "X-API-Key: key"` → 4 pods
- [ ] Mock RBAC: See admin badges in response
- [ ] Threats endpoint: `POST` → 200 OK

✅ **Frontend**
- [ ] Page loads: http://localhost:5173
- [ ] Network tab: Shows 4 mock pods
- [ ] Topology: Shows 10+ nodes
- [ ] Security tab: Shows RBAC, privileged pods
- [ ] Threats tab: Shows connection status

✅ **Integration**
- [ ] Send threat event
- [ ] Frontend receives via WebSocket
- [ ] Event appears in Threats tab
- [ ] Color-coded by priority
- [ ] All features work together

---

## When Ready for Real K8s

Once you have a K8s cluster (Docker Desktop or Minikube):

1. Follow `LOCAL_K8S_SETUP.md`
2. Deploy sample pods
3. Backend automatically switches from mock to real data
4. All features work with real data
5. Deploy Falco for real threat detection

---

## Commands Reference

### Start Testing Environment

```bash
# Option 1: Real docker compose (mock K8s data)
docker compose up

# Option 2: Test compose with explicit settings
docker compose -f docker-compose.test.yml up --build

# Option 3: Local development with real K8s cluster
# (after enabling K8s in Docker Desktop)
docker compose up
```

### Send Test Threats

```powershell
# Single threat
$event = @{
    output = "Test threat"
    priority = "Warning"
    rule = "Test_Rule"
    time = (Get-Date -AsUTC).ToString("o")
    output_fields = @{}
} | ConvertTo-Json

Invoke-WebRequest http://localhost:8000/api/threats/falco `
    -Method POST `
    -Headers @{"X-API-Key"="your-secret-api-key-change-this";"Content-Type"="application/json"} `
    -Body $event -UseBasicParsing
```

### Monitor Backend

```bash
docker logs -f backend
```

### Monitor Frontend

```bash
# Browser console: F12 → Console tab
# Check Network tab for API calls
```

---

## Success Criteria

You've successfully tested the dashboard when:

✅ Frontend loads at http://localhost:5173
✅ Network tab shows mock pods
✅ Security tab shows RBAC & warnings
✅ Threats tab shows "Threats Live"
✅ Can send test threats and see them appear
✅ All 3 tabs work together
✅ No console errors
✅ API key authentication works
✅ WebSocket reconnects automatically

---

## Next: Real K8s Testing

Once you have a real K8s cluster:

1. Enable Kubernetes in Docker Desktop OR install Minikube
2. Deploy test pods: `kubectl run test --image=nginx`
3. Backend auto-detects kubeconfig and connects
4. Frontend shows real pods instead of mock
5. Follow `TEST_CHECKLIST.md` for full verification
6. Deploy Falco for real threat detection

---

## Files Created

- `mock_k8s_api.py` (optional mock endpoints)
- `docker-compose.test.yml` (testing configuration)
- `LOCAL_K8S_SETUP.md` (local cluster setup)

---

## Status

✅ **Ready to test WITHOUT Kubernetes**
✅ **Mock data realistic and complete**
✅ **All features testable with mock data**
✅ **Easy migration to real K8s when available**

**Start with**: `docker compose up` and visit http://localhost:5173

