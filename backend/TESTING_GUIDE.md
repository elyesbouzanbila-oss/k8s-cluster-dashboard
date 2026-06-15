# K8s Dashboard Backend - Testing Guide

Comprehensive testing suite for network discovery, security audits, and threat detection.

---

## Overview

This testing guide covers:
- **Unit tests** with mock fixtures (realistic K8s data)
- **Integration tests** against live API endpoints
- **Security tests** (authentication, RBAC, privileged containers)
- **Network tests** (topology, pod discovery)
- **Threat tests** (Falco event ingestion)

---

## Test Fixtures

### File: `test_fixtures.py`

Provides realistic mock Kubernetes data for testing without a real cluster.

#### MockPodFixtures
5 pods across 4 namespaces simulating production environment:
- `api-server-prod-1` (production) - Multi-container pod with sidecar
- `database-backup-job` (production) - Backup job pod
- `monitoring-prometheus-0` (monitoring) - StatefulSet pod
- `kube-apiserver` (kube-system) - Control plane pod
- `redis-cache-prod` (production) - Cache pod

#### MockServiceFixtures
4 services demonstrating different types:
- `api-service` (LoadBalancer) - Public-facing service with external IP
- `database-service` (ClusterIP) - Internal database service
- `prometheus` (ClusterIP) - Monitoring service
- `kubernetes` (ClusterIP) - Default K8s API service

#### MockRBACFixtures
5 RBAC bindings including security concerns:
- `admin-cluster-binding` - Multiple admins
- `developers-edit-binding` - Group-based access
- `readers-view-binding` - Multiple subjects
- `system-cluster-binding` - System service account
- `cidwf-elevated-access` - ⚠️ External contractor with cluster-admin

#### MockSecurityFixtures
4 pods with security contexts (some high-risk):
- `kube-apiserver` - PRIVILEGED + ROOT (expected)
- `kubelet-node-init` - PRIVILEGED + ROOT (expected)
- `network-admin-pod` - Running as ROOT (risky)
- `monitoring-collector` - Non-privileged (safe)

#### MockThreatFixtures
5 realistic Falco security events:
- Suspicious file write
- Privilege escalation attempt
- Unauthorized process execution
- Sensitive file access
- Network anomaly

---

## Running Tests

### 1. Test Fixtures (Data Generation)

Display mock data and run scenario analysis WITHOUT calling API:

```bash
# Run fixture tests
python test_fixtures.py
```

**Output:**
- Network topology discovery scenario
- Pod discovery analysis
- RBAC audit with elevated access detection
- Privileged container identification
- Threat event analysis

**Example Output:**
```
============================================================
SECURITY TEST: RBAC Audit - Elevated Access Detection
============================================================

Cluster-Admin Bindings Found: 2

ClusterRoleBinding: admin-cluster-binding
  Subject: User - admin@company.com
  Subject: User - devops@company.com

ClusterRoleBinding: cidwf-elevated-access
  Subject: User - contractor@external.com
    ⚠️  WARNING: External contractor has cluster-admin access!

...
```

### 2. Integration Tests (API Testing)

Call actual API endpoints and verify responses:

```bash
# Install httpx if not already installed
pip install httpx

# Run integration tests
python test_integration.py
```

**Tests Included:**

#### Health Checks
```
GET / → 200 OK
Returns: {"status": "ok", "message": "K8s Dashboard API is running"}
```

#### Threat Detection Tests
```
POST /api/threats/falco (5 events)
- Sends each Falco event to webhook
- Expects: 200 OK for each

Authentication tests:
- Without X-API-Key → 401 Unauthorized
- With wrong key → 403 Forbidden
- With valid key → 200 OK (or K8s error if no cluster)
```

#### Network Discovery Tests
```
GET /api/network/pods
- Expects: 200 OK with pod list OR 500 error if K8s not configured
- Shows: Namespace breakdown, pod count, sample pods

GET /api/network/topology
- Expects: 200 OK with topology nodes/edges
- Shows: Node count, service count, pod sample
```

#### Security Audit Tests
```
GET /api/security/rbac
- Expects: 200 OK with RBAC bindings
- Analyzes: Cluster-admin count, binding sample

GET /api/security/privileged
- Expects: 200 OK with privileged pods
- Shows: Risk summary, high-risk pod list
```

---

## Test Results Interpretation

### Successful Test (Cluster Configured)

```
TEST: Network Pods Endpoint
============================================================

Fetching pods from /api/network/pods...
  ✓ Status 200 - Retrieved 45 pods

  Sample pods:
    • production/api-server-prod-1 (Running)
    • production/database-backup (Running)
    • monitoring/prometheus-0 (Running)
```

### Cluster Not Available (Expected Behavior)

```
TEST: Network Pods Endpoint
============================================================

Fetching pods from /api/network/pods...
  ℹ️  Status 500 - K8s cluster not configured (expected)
  Error: Invalid kube-config file. Expected key current-context in kube-config
```

**Solution**: Configure K8s cluster access:
- Set up kubeconfig file
- Use `--kubeconfig` flag
- Or run inside K8s cluster (incluster mode)

### Authentication Failed

```
TEST: Falco Webhook Authentication
============================================================

Test 1: Request without X-API-Key header
  ✓ Status 401 - Correctly rejected

Test 2: Request with wrong X-API-Key
  ✓ Status 403 - Correctly rejected
```

---

## Manual Testing with curl/PowerShell

### 1. Health Check (No Auth Required)

**PowerShell:**
```powershell
Invoke-WebRequest -Uri http://localhost:8000/ -UseBasicParsing | Select-Object -ExpandProperty Content
```

**Output:**
```json
{"status":"ok","message":"K8s Dashboard API is running"}
```

### 2. Send Falco Events

**PowerShell:**
```powershell
$event = @{
    output = "Suspicious process execution detected"
    priority = "Critical"
    rule = "Suspicious_Process_Execution"
    time = "2026-01-15T10:30:00Z"
    output_fields = @{
        process_name = "curl"
        user = "root"
    }
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri http://localhost:8000/api/threats/falco `
  -Method POST `
  -Headers @{
    "X-API-Key" = "your-secret-api-key-change-this"
    "Content-Type" = "application/json"
  } `
  -Body $event `
  -UseBasicParsing

$response.StatusCode  # Should be 200
```

### 3. Query Network Pods

**PowerShell:**
```powershell
$response = Invoke-WebRequest -Uri http://localhost:8000/api/network/pods `
  -Headers @{"X-API-Key" = "your-secret-api-key-change-this"} `
  -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
```

### 4. Query Security RBAC

**PowerShell:**
```powershell
$response = Invoke-WebRequest -Uri http://localhost:8000/api/security/rbac `
  -Headers @{"X-API-Key" = "your-secret-api-key-change-this"} `
  -UseBasicParsing

($response.Content | ConvertFrom-Json) | Select-Object -First 3
```

### 5. Query Privileged Pods

**PowerShell:**
```powershell
$response = Invoke-WebRequest -Uri http://localhost:8000/api/security/privileged `
  -Headers @{"X-API-Key" = "your-secret-api-key-change-this"} `
  -UseBasicParsing

$response.Content | ConvertFrom-Json | Where-Object { $_.run_as_user -eq 0 }
```

---

## Batch Testing Script

Create `test_all.ps1` for comprehensive testing:

```powershell
# test_all.ps1

$API_URL = "http://localhost:8000"
$API_KEY = "your-secret-api-key-change-this"
$headers = @{
    "X-API-Key" = $API_KEY
    "Content-Type" = "application/json"
}

Write-Host "=== K8s Dashboard Backend - Batch Test ===" -ForegroundColor Cyan

# Test 1: Health
Write-Host "`n1. Health Check..."
try {
    $r = Invoke-WebRequest -Uri "$API_URL/" -UseBasicParsing
    Write-Host "✓ $($r.StatusCode) OK" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed" -ForegroundColor Red
}

# Test 2: Falco Webhook
Write-Host "`n2. Falco Webhook..."
$event = @{
    output = "Test event"
    priority = "Warning"
    rule = "Test_Rule"
    time = (Get-Date -AsUTC).ToString("o")
    output_fields = @{}
} | ConvertTo-Json

try {
    $r = Invoke-WebRequest -Uri "$API_URL/api/threats/falco" `
        -Method POST -Headers $headers -Body $event -UseBasicParsing
    Write-Host "✓ $($r.StatusCode) - Event published" -ForegroundColor Green
} catch {
    Write-Host "✗ $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

# Test 3: Network Pods
Write-Host "`n3. Network Pods Endpoint..."
try {
    $r = Invoke-WebRequest -Uri "$API_URL/api/network/pods" -Headers $headers -UseBasicParsing
    Write-Host "✓ $($r.StatusCode) - Retrieved pods" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 500) {
        Write-Host "ℹ️  500 - K8s cluster not configured (expected)" -ForegroundColor Yellow
    } else {
        Write-Host "✗ $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

# Test 4: Security RBAC
Write-Host "`n4. Security RBAC Endpoint..."
try {
    $r = Invoke-WebRequest -Uri "$API_URL/api/security/rbac" -Headers $headers -UseBasicParsing
    Write-Host "✓ $($r.StatusCode) - Retrieved RBAC" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 500) {
        Write-Host "ℹ️  500 - K8s cluster not configured (expected)" -ForegroundColor Yellow
    } else {
        Write-Host "✗ $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

# Test 5: Privileged Pods
Write-Host "`n5. Privileged Pods Endpoint..."
try {
    $r = Invoke-WebRequest -Uri "$API_URL/api/security/privileged" -Headers $headers -UseBasicParsing
    Write-Host "✓ $($r.StatusCode) - Retrieved privileged pods" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 500) {
        Write-Host "ℹ️  500 - K8s cluster not configured (expected)" -ForegroundColor Yellow
    } else {
        Write-Host "✗ $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

# Test 6: Auth Required
Write-Host "`n6. Authentication Check..."
try {
    Invoke-WebRequest -Uri "$API_URL/api/network/pods" -UseBasicParsing
    Write-Host "✗ Should have been blocked" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✓ 401 - Auth correctly enforced" -ForegroundColor Green
    }
}

Write-Host "`n=== Tests Complete ===" -ForegroundColor Cyan
```

Run:
```powershell
.\test_all.ps1
```

---

## Automating Tests with Docker Compose

Add a test service to `docker-compose.yml`:

```yaml
test:
  build: ./backend
  depends_on:
    - backend
    - redis
  environment:
    - API_KEY=your-secret-api-key-change-this
  command: >
    sh -c "
    pip install httpx &&
    python test_integration.py
    "
  profiles:
    - test
```

Run tests:
```bash
docker compose --profile test run --rm test
```

---

## Common Test Scenarios

### Scenario 1: K8s Cluster Connected
Expected results:
- All endpoints return `200 OK`
- Pod/service/RBAC data populated
- Topology nodes and edges returned

### Scenario 2: K8s Cluster Not Available (Default)
Expected results:
- `/api/network/pods` → `500` (kubeconfig missing)
- `/api/network/topology` → `500` (kubeconfig missing)
- `/api/security/rbac` → `500` (kubeconfig missing)
- `/api/security/privileged` → `500` (kubeconfig missing)
- `/api/threats/falco` → `200 OK` (doesn't require K8s)

### Scenario 3: Authentication Failures
Expected results:
- No X-API-Key → `401 Unauthorized`
- Wrong X-API-Key → `403 Forbidden`
- Valid X-API-Key → Request proceeds

### Scenario 4: Threat Detection
Expected results:
- All Falco events published → `200 OK`
- Events stored in Redis
- WebSocket clients receive events

---

## Continuous Integration

Example GitHub Actions workflow:

```yaml
name: Backend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      
      - name: Run fixture tests
        run: cd backend && python test_fixtures.py
      
      - name: Start backend
        run: cd backend && uvicorn main:app --port 8000 &
      
      - name: Wait for backend
        run: sleep 3
      
      - name: Run integration tests
        run: cd backend && python test_integration.py
```

---

## Troubleshooting

### Tests hang or timeout
- Verify backend is running: `http://localhost:8000/`
- Check Redis is running: `redis-cli ping`
- Increase timeout in test scripts if network is slow

### Authentication failures
- Verify API_KEY matches in `.env` and test script
- Check CORS allows your client origin
- Verify X-API-Key header format (no extra spaces)

### K8s endpoints return 500
- Expected if no kubeconfig file
- Configure K8s cluster to get real data
- See `connection/factory.py` for configuration options

### Falco webhook returns 500
- Check Redis connection: verify `REDIS_URL` in `.env`
- Check event schema matches `models/threat.py`
- Review backend logs: `docker logs backend`

---

## Next Steps

1. **Connect K8s cluster**: Configure kubeconfig/token
2. **Deploy Falco agent**: Send real threat events
3. **Connect frontend**: Test full end-to-end flow
4. **Add load testing**: Use `locust` for performance testing
5. **Set up monitoring**: Monitor backend with Prometheus

---

## Files Reference

- `test_fixtures.py` - Mock data and scenario analysis
- `test_integration.py` - API endpoint testing
- `test_all.ps1` - Batch PowerShell tests
- `APP_LOGIC_ANALYSIS.md` - Backend architecture
- `SECURITY_FIXES.md` - Security configuration

