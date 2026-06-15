# Testing Without Kubernetes - Complete Guide

Since you don't have a K8s cluster yet, here are your options ordered by ease:

## 🚀 Option 1: Test with Mock Data (RECOMMENDED - 5 min)

**Best for**: Quick testing, no K8s needed, realistic data

Everything works with realistic mock Kubernetes data!

### Start

```bash
docker compose up
```

### Visit

```
Frontend: http://localhost:5173
Backend:  http://localhost:8000
```

### Test Each Tab

**Network Tab**:
- See 4 realistic pods
- Pod IPs, containers, labels
- Cluster topology with services

**Security Tab**:
- See RBAC bindings
- Admin users highlighted
- Privileged pods warned

**Threats Tab**:
- See "Threats Live" indicator
- Send test threats (see below)
- Verify real-time updates

### Send Test Threats (Real!)

```powershell
# Send threat to backend
$event = @{
    output = "Test threat from frontend"
    priority = "Critical"
    rule = "Test_Rule"
    time = (Get-Date -AsUTC).ToString("o")
    output_fields = @{pod="test";namespace="testing"}
} | ConvertTo-Json

Invoke-WebRequest http://localhost:8000/api/threats/falco `
    -Method POST `
    -Headers @{"X-API-Key"="your-secret-api-key-change-this";"Content-Type"="application/json"} `
    -Body $event -UseBasicParsing

# Watch frontend Threats tab - event appears immediately!
```

### ✅ Success When

- Frontend shows mock pods
- Security shows mock RBAC
- Threats accepts events
- All tabs responsive

---

## 🔧 Option 2: Local Kubernetes (10 min)

**Best for**: Testing with real K8s, still local

### Setup Kubernetes

Choose one:

#### A) Docker Desktop K8s (Easiest)

1. Open Docker Desktop Settings
2. Kubernetes → Enable Kubernetes
3. Wait 2-3 min
4. Done!

```bash
kubectl get nodes  # Verify
```

#### B) Minikube (More Control)

```powershell
choco install minikube kubectl
minikube start --driver=docker
```

#### C) Kind (Lightweight)

```powershell
choco install kind
kind create cluster
```

### Deploy Test Pods

```bash
# Create namespace
kubectl create namespace testing

# Deploy pods
kubectl run app1 --image=nginx:latest -n testing
kubectl run app2 --image=nginx:latest -n testing
kubectl run app3 --image=redis:alpine -n testing

# Verify
kubectl get pods -n testing
```

### Test Dashboard

1. Open http://localhost:5173
2. Click Network tab
3. **Should see your real pods!**

### Send Threats

Same as Option 1 - send via HTTP:

```powershell
# Send from PowerShell
# Threats tab receives via WebSocket
```

---

## 📊 Option 3: Full Testing Checklist

Run all 25 tests from `TEST_CHECKLIST.md`:

```bash
# Backend tests
.venv/Scripts/python.exe test_data_demo.py
.venv/Scripts/python.exe test_fixtures.py

# Manual tests
# Follow TEST_CHECKLIST.md step by step
```

---

## ⚡ Quick Comparison

| Option | Setup Time | Data | Features |
|--------|-----------|------|----------|
| Mock Data | 1 min | Realistic mock | All work |
| Docker K8s | 3-5 min | Real K8s | All work |
| Minikube | 10 min | Real K8s | All work |
| Full Test | 30 min | Real K8s | All work + verified |

---

## 🎯 Recommended Path

### Day 1: Quick Validation (15 min)

```bash
# 1. Start services
docker compose up

# 2. Test mock data
# Visit http://localhost:5173
# Verify all 3 tabs work

# 3. Send test threats
# See them appear in real-time

# 4. Verify auth
# Try without API key → 401
# Try with wrong key → 403
```

### Day 2: Local K8s (30 min)

```bash
# 1. Enable K8s in Docker Desktop

# 2. Deploy test pods
kubectl run test1 --image=nginx:latest
kubectl run test2 --image=redis:alpine

# 3. Test with real pods
# Visit frontend → see real pods

# 4. Run full test checklist
# Follow TEST_CHECKLIST.md
```

### Day 3: Advanced Testing (Optional - 2 hours)

```bash
# 1. Install Falco agent
# Send real security events

# 2. Test all detection rules
# Trigger suspicious behavior

# 3. Load testing
# Send 100+ events

# 4. Performance validation
# Monitor latency
```

---

## 📋 Verification Checklist

### ✅ Frontend Works

- [ ] http://localhost:5173 loads
- [ ] Three tabs visible: Network, Security, Threats
- [ ] No console errors (F12)
- [ ] All buttons clickable

### ✅ Backend Works

- [ ] http://localhost:8000/ returns 200
- [ ] `/api/threats/falco` accepts POST
- [ ] `/api/network/pods` requires API key
- [ ] WebSocket connects

### ✅ Integration Works

- [ ] Network tab shows data
- [ ] Security tab shows data
- [ ] Threats tab shows "Live"
- [ ] Send threat → appears immediately
- [ ] Refresh page → still works

### ✅ Real Data (Optional)

- [ ] K8s cluster running
- [ ] Pods deployed
- [ ] Frontend shows pods
- [ ] Tests pass

---

## 🔗 File References

| File | Purpose | Read When |
|------|---------|-----------|
| `MOCK_K8S_TESTING.md` | Mock K8s details | Want mock-only testing |
| `LOCAL_K8S_SETUP.md` | Local K8s setup | Ready for real cluster |
| `TEST_CHECKLIST.md` | 17 manual tests | Full verification |
| `TESTING_GUIDE.md` | Complete test guide | Deep dive |
| `FRONTEND_README.md` | Frontend features | Understanding UI |
| `SECURITY_FIXES.md` | Auth & CORS | Security details |

---

## 🚀 Start Now

### Option 1 (Fastest - 5 min)

```bash
docker compose up
# Visit http://localhost:5173
# Click through all 3 tabs
# Send test threat
# Done! ✓
```

### Option 2 (With Real K8s - 15 min)

```bash
# Enable K8s in Docker Desktop
docker compose up
kubectl run app --image=nginx
# Visit http://localhost:5173
# See real pods in Network tab
# Done! ✓
```

### Option 3 (Full Testing - 1 hour)

```bash
# Follow TEST_CHECKLIST.md
# Run all 17 tests
# Verify everything
# Done! ✓
```

---

## ⚠️ Troubleshooting

### Frontend won't load

```bash
# Check backend is running
curl http://localhost:8000/

# Check frontend dev server
npm run dev  # in frontend directory
```

### Pods not showing

```bash
# Option 1: Using mock data (should always work)
# Just reload frontend

# Option 2: Using real K8s
# Check cluster: kubectl get nodes
# Check pods: kubectl get pods --all-namespaces
# Check backend logs: docker logs backend
```

### Threats not streaming

```bash
# Check WebSocket connection (F12 → Network → WebSocket)
# Send test threat
# Check backend logs for errors
```

### API key not working

```bash
# Verify key in .env.local
# Check header is present: X-API-Key
# Try without key → should get 401
```

---

## 📝 Testing Scenarios

### Scenario 1: Verify All Features (5 min)

1. Open frontend
2. Network tab: See pods
3. Security tab: See RBAC
4. Threats tab: Send event
5. All work? ✅

### Scenario 2: Stress Test (10 min)

1. Send 10 threats in rapid succession
2. Frontend handles all
3. No lag or errors
4. All appear in list ✅

### Scenario 3: Connection Test (5 min)

1. Close tab
2. Reopen
3. WebSocket reconnects
4. All data reloads ✅

### Scenario 4: Auth Test (3 min)

1. No API key → 401 ✅
2. Wrong API key → 403 ✅
3. Valid API key → 200 ✅

---

## 🎉 Success Metrics

You've validated everything when:

- ✅ Frontend responsive
- ✅ All tabs load data
- ✅ Real-time threats work
- ✅ API auth enforced
- ✅ No console errors
- ✅ All features tested

---

## Next: Real Kubernetes

When ready for real K8s:

1. Follow `LOCAL_K8S_SETUP.md`
2. Deploy pods
3. Backend auto-connects
4. Frontend shows real pods
5. Deploy Falco for real threats
6. Full integration test

---

## Summary

**No K8s cluster?** ➜ **Start with Option 1** (mock data)
**Have Docker Desktop?** ➜ **Try Option 2** (enable K8s)
**Want full validation?** ➜ **Follow Option 3** (all tests)

---

**Ready?**

```bash
docker compose up
```

Then visit: http://localhost:5173

👉 **Click on Network tab and start exploring!**

