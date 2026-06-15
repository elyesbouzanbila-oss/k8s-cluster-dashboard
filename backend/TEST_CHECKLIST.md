# K8s Dashboard Backend - Test Checklist

Quick reference for testing all backend functionality.

---

## Pre-Test Setup

- [ ] Backend running: `docker compose up` or `.venv\Scripts\uvicorn.exe main:app --port 8000`
- [ ] Redis running and accessible
- [ ] API key ready: `your-secret-api-key-change-this`
- [ ] Test environment: Windows PowerShell or WSL bash

---

## 1. Test Data & Fixtures

### Display Mock Data

```powershell
# Show realistic K8s test data
.venv\Scripts\python.exe test_data_demo.py
```

**Verifies:**
- 4 pods across 2 namespaces (production + monitoring)
- 3 RBAC bindings (including high-risk contractor)
- 3 threat events (Critical, High, Medium priority)

- [ ] Pods displayed correctly
- [ ] RBAC high-risk warning shown
- [ ] Threat events listed by priority

---

## 2. Health & Authentication Tests

### Test 1: Health Check (No Auth)

```powershell
Invoke-WebRequest -Uri http://localhost:8000/ -UseBasicParsing | Select-Object -ExpandProperty Content
```

**Expected:** `{"status":"ok","message":"K8s Dashboard API is running"}`

- [ ] Status 200 OK
- [ ] Response contains "status": "ok"

### Test 2: Authentication Enforced

```powershell
# Without X-API-Key
try { 
    Invoke-WebRequest -Uri http://localhost:8000/api/network/pods -UseBasicParsing 
} catch { 
    Write-Host "Status: $($_.Exception.Response.StatusCode)" 
}
```

**Expected:** 401 Unauthorized

- [ ] Status 401 received
- [ ] Error message: "Missing X-API-Key header"

### Test 3: Wrong API Key Rejected

```powershell
# With invalid X-API-Key
try { 
    Invoke-WebRequest -Uri http://localhost:8000/api/network/pods `
        -Headers @{"X-API-Key"="wrong-key"} -UseBasicParsing 
} catch { 
    Write-Host "Status: $($_.Exception.Response.StatusCode)" 
}
```

**Expected:** 403 Forbidden

- [ ] Status 403 received
- [ ] Error message: "Invalid API key"

---

## 3. Threat Detection Tests

### Test 1: Send Single Falco Event

```powershell
$event = @{
    output = "Suspicious process detected"
    priority = "Warning"
    rule = "Suspicious_Process"
    time = "2026-01-15T10:30:00Z"
    output_fields = @{ process = "curl"; user = "root" }
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:8000/api/threats/falco `
    -Method POST `
    -Headers @{"X-API-Key"="your-secret-api-key-change-this";"Content-Type"="application/json"} `
    -Body $event -UseBasicParsing
```

**Expected:** `{"status":"ok"}` (200 OK)

- [ ] Status 200 OK
- [ ] Response: {"status":"ok"}
- [ ] Event published to Redis

### Test 2: Send Multiple Threat Events

```powershell
$threats = @(
    @{ output="Critical threat"; priority="Critical"; rule="CriticalRule"; time="2026-01-15T10:30:00Z"; output_fields=@{} },
    @{ output="High alert"; priority="High"; rule="HighRule"; time="2026-01-15T10:31:00Z"; output_fields=@{} },
    @{ output="Medium warning"; priority="Medium"; rule="MediumRule"; time="2026-01-15T10:32:00Z"; output_fields=@{} }
)

foreach ($threat in $threats) {
    $body = $threat | ConvertTo-Json
    $r = Invoke-WebRequest -Uri http://localhost:8000/api/threats/falco `
        -Method POST `
        -Headers @{"X-API-Key"="your-secret-api-key-change-this";"Content-Type"="application/json"} `
        -Body $body -UseBasicParsing
    Write-Host "Event [$($threat.priority)]: $($r.StatusCode)"
}
```

**Expected:** All 3 events return 200 OK

- [ ] Critical event: 200 OK
- [ ] High event: 200 OK
- [ ] Medium event: 200 OK

### Test 3: Falco Webhook Auth

```powershell
$event = @{ output="test"; priority="Warning"; rule="Test"; time="2026-01-15T10:30:00Z"; output_fields=@{} } | ConvertTo-Json

# Without auth
try { 
    Invoke-WebRequest -Uri http://localhost:8000/api/threats/falco -Method POST `
        -Headers @{"Content-Type"="application/json"} -Body $event -UseBasicParsing 
} catch { 
    Write-Host "No auth: $($_.Exception.Response.StatusCode)" 
}

# With wrong auth
try { 
    Invoke-WebRequest -Uri http://localhost:8000/api/threats/falco -Method POST `
        -Headers @{"X-API-Key"="wrong";"Content-Type"="application/json"} -Body $event -UseBasicParsing 
} catch { 
    Write-Host "Wrong auth: $($_.Exception.Response.StatusCode)" 
}
```

**Expected:** 401 and 403 respectively

- [ ] No auth: 401 Unauthorized
- [ ] Wrong auth: 403 Forbidden

---

## 4. Network Discovery Tests

### Test 1: Query Pods Endpoint

```powershell
Invoke-WebRequest -Uri http://localhost:8000/api/network/pods `
    -Headers @{"X-API-Key"="your-secret-api-key-change-this"} `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json
```

**Expected (if K8s configured):** List of pods with metadata
**Expected (if K8s not configured):** 500 error (normal for testing)

- [ ] Returns 200 (K8s connected) OR 500 (K8s not configured)
- [ ] Response format valid JSON
- [ ] If 200: contains "items" array

### Test 2: Query Topology Endpoint

```powershell
Invoke-WebRequest -Uri http://localhost:8000/api/network/topology `
    -Headers @{"X-API-Key"="your-secret-api-key-change-this"} `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json
```

**Expected (if K8s configured):** Topology with nodes and edges
**Expected (if K8s not configured):** 500 error

- [ ] Returns 200 (K8s connected) OR 500 (K8s not configured)
- [ ] Response contains "nodes" array
- [ ] Response contains "edges" array
- [ ] Nodes have type: "pod" or "service"

---

## 5. Security Audit Tests

### Test 1: Query RBAC Bindings

```powershell
$result = Invoke-WebRequest -Uri http://localhost:8000/api/security/rbac `
    -Headers @{"X-API-Key"="your-secret-api-key-change-this"} `
    -UseBasicParsing
    
$result.Content | ConvertFrom-Json | ConvertTo-Json -Depth 2 | Select-Object -First 20
```

**Expected (if K8s configured):** RBAC bindings with subjects and roles
**Expected (if K8s not configured):** 500 error

- [ ] Returns 200 (K8s connected) OR 500 (K8s not configured)
- [ ] If 200: contains array of bindings
- [ ] Each binding has: name, subjects, role_ref

### Test 2: Query Privileged Pods

```powershell
$result = Invoke-WebRequest -Uri http://localhost:8000/api/security/privileged `
    -Headers @{"X-API-Key"="your-secret-api-key-change-this"} `
    -UseBasicParsing
    
$pods = $result.Content | ConvertFrom-Json
Write-Host "Found $($pods.Count) high-risk pods"
$pods | Select-Object namespace, name, privileged, run_as_user
```

**Expected (if K8s configured):** Privileged pods with security context
**Expected (if K8s not configured):** 500 error

- [ ] Returns 200 (K8s connected) OR 500 (K8s not configured)
- [ ] If 200: contains array of privileged pods
- [ ] Each pod has: namespace, name, container, image, privileged, run_as_user

### Test 3: Identify High-Risk RBAC

```powershell
$result = Invoke-WebRequest -Uri http://localhost:8000/api/security/rbac `
    -Headers @{"X-API-Key"="your-secret-api-key-change-this"} `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json

$admin_bindings = $result | Where-Object { $_.role_ref.name -eq "cluster-admin" }
Write-Host "Cluster-admin bindings: $($admin_bindings.Count)"
$admin_bindings | Select-Object name, subjects
```

**Expected:** Returns cluster-admin bindings (risky)

- [ ] Query executes successfully
- [ ] Identifies cluster-admin bindings
- [ ] Lists subjects with elevated access

---

## 6. CORS Tests

### Test 1: Allowed Origin (Frontend)

```powershell
$headers = @{
    "X-API-Key" = "your-secret-api-key-change-this"
    "Origin" = "http://localhost:5173"
}

$r = Invoke-WebRequest -Uri http://localhost:8000/ -Headers $headers -UseBasicParsing
$r.Headers["Access-Control-Allow-Origin"]
```

**Expected:** Should show `http://localhost:5173`

- [ ] CORS header present
- [ ] Matches FRONTEND_URL in .env

### Test 2: Disallowed Origin

```powershell
$headers = @{
    "X-API-Key" = "your-secret-api-key-change-this"
    "Origin" = "http://evil.com"
}

$r = Invoke-WebRequest -Uri http://localhost:8000/ -Headers $headers -UseBasicParsing
$r.Headers["Access-Control-Allow-Origin"]
```

**Expected:** Should be empty or not present

- [ ] CORS header NOT set for unauthorized origin
- [ ] Request still succeeds (CORS doesn't block)

---

## 7. End-to-End Scenario Tests

### Scenario 1: Full Threat Detection Flow

1. [ ] Send Falco event via webhook → 200 OK
2. [ ] Event published to Redis
3. [ ] WebSocket client could receive event (if connected)

### Scenario 2: Security Audit

1. [ ] Query RBAC bindings → 200 OK (or 500 if no K8s)
2. [ ] Identify cluster-admin users
3. [ ] Query privileged pods → 200 OK (or 500 if no K8s)
4. [ ] Identify root-running containers

### Scenario 3: Network Topology

1. [ ] Query pods → 200 OK (or 500 if no K8s)
2. [ ] Query topology → 200 OK (or 500 if no K8s)
3. [ ] Topology contains pods and services
4. [ ] Nodes have correct IPs and namespaces

---

## 8. Performance & Load Tests

### Test 1: Multiple Rapid Requests

```powershell
# Send 10 Falco events rapidly
for ($i = 1; $i -le 10; $i++) {
    $event = @{
        output = "Event $i"
        priority = "Warning"
        rule = "Test_$i"
        time = (Get-Date -AsUTC).ToString("o")
        output_fields = @{}
    } | ConvertTo-Json
    
    $r = Invoke-WebRequest -Uri http://localhost:8000/api/threats/falco `
        -Method POST `
        -Headers @{"X-API-Key"="your-secret-api-key-change-this";"Content-Type"="application/json"} `
        -Body $event -UseBasicParsing
    Write-Host "Request $i: $($r.StatusCode)"
}
```

**Expected:** All 10 requests return 200 OK

- [ ] All requests succeed
- [ ] Response times consistent
- [ ] No rate limiting errors

### Test 2: Concurrent Requests

```powershell
# Using job-based concurrency in PowerShell
$jobs = @()
for ($i = 1; $i -le 5; $i++) {
    $job = Start-Job -ScriptBlock {
        param($num)
        for ($j = 1; $j -le 3; $j++) {
            Invoke-WebRequest -Uri http://localhost:8000/ -UseBasicParsing -ErrorAction SilentlyContinue
        }
        Write-Output "Thread $num completed"
    } -ArgumentList $i
    $jobs += $job
}

Wait-Job $jobs
$jobs | Receive-Job
```

**Expected:** All jobs complete successfully

- [ ] All concurrent requests succeed
- [ ] No connection errors
- [ ] Backend remains responsive

---

## 9. Error Handling Tests

### Test 1: Invalid JSON Body

```powershell
try {
    Invoke-WebRequest -Uri http://localhost:8000/api/threats/falco `
        -Method POST `
        -Headers @{"X-API-Key"="your-secret-api-key-change-this";"Content-Type"="application/json"} `
        -Body "invalid json" `
        -UseBasicParsing
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode)"
}
```

**Expected:** 422 Unprocessable Entity

- [ ] Returns 422 error
- [ ] Error message indicates invalid JSON

### Test 2: Missing Required Fields

```powershell
$event = @{ output = "Missing fields" } | ConvertTo-Json

try {
    Invoke-WebRequest -Uri http://localhost:8000/api/threats/falco `
        -Method POST `
        -Headers @{"X-API-Key"="your-secret-api-key-change-this";"Content-Type"="application/json"} `
        -Body $event `
        -UseBasicParsing
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode)"
}
```

**Expected:** 422 Unprocessable Entity

- [ ] Returns 422 error
- [ ] Lists missing required fields

---

## 10. Final Verification

- [ ] All health checks pass
- [ ] All authentication tests pass
- [ ] All threat detection tests pass
- [ ] Security endpoints respond (or give expected 500)
- [ ] Network endpoints respond (or give expected 500)
- [ ] CORS configured correctly
- [ ] Error handling works
- [ ] Performance acceptable

---

## Test Summary

| Category | Tests | Status |
|----------|-------|--------|
| Health & Auth | 3 | [ ] PASS |
| Threat Detection | 3 | [ ] PASS |
| Network Discovery | 2 | [ ] PASS |
| Security Audit | 3 | [ ] PASS |
| CORS | 2 | [ ] PASS |
| Performance | 2 | [ ] PASS |
| Error Handling | 2 | [ ] PASS |
| **Total** | **17** | [ ] ALL PASS |

---

## Sign-Off

- [ ] All tests completed
- [ ] All tests passed
- [ ] Backend ready for production
- [ ] Date: _________
- [ ] Tested by: _________

