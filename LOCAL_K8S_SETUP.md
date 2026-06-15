# Local Kubernetes Testing Setup

Guide to set up a local K8s cluster and test the dashboard end-to-end.

## Option 1: Docker Desktop Kubernetes (Recommended - 5 minutes)

### Easiest Method

Docker Desktop comes with Kubernetes built-in. Just enable it!

#### Step 1: Enable Kubernetes in Docker Desktop

1. Open **Docker Desktop**
2. Go to **Settings** → **Kubernetes**
3. Check **Enable Kubernetes**
4. Click **Apply & Restart**
5. Wait 2-3 minutes for cluster to start

#### Step 2: Verify Installation

```powershell
kubectl version --client
kubectl get nodes
```

Expected output:
```
NAME             STATUS   ROLES           AGE     VERSION
docker-desktop   Ready    control-plane   1m      v1.28.0
```

#### Step 3: Configure Backend

Edit backend `.env`:
```env
# Backend will auto-detect kubeconfig from Docker Desktop
KUBECONFIG=~/.kube/config
```

Restart backend:
```bash
docker compose down
docker compose up
```

#### Step 4: Test

Go to **http://localhost:5173** → **Network tab** → Should see pods!

---

## Option 2: Minikube (More Control - 10 minutes)

### Install Minikube

#### On Windows

```powershell
# Download Minikube
curl.exe -Lo minikube.exe https://github.com/kubernetes/minikube/releases/latest/download/minikube-windows-amd64.exe
Move-Item .\minikube.exe "$env:ProgramFiles\Minikube"

# Add to PATH
$env:Path += ";$env:ProgramFiles\Minikube"
```

Or use Chocolatey:
```powershell
choco install minikube
choco install kubectl
```

#### Start Minikube

```powershell
minikube start --driver=docker --cpus=4 --memory=8192
```

This creates a K8s cluster in Docker with:
- 4 CPUs
- 8GB RAM
- Docker driver (runs in containers)

#### Verify

```powershell
kubectl get nodes
minikube status
```

---

## Option 3: Kind (Kubernetes in Docker - 8 minutes)

### Install Kind

```powershell
# Using Chocolatey
choco install kind

# Or download directly
curl.exe -Lo kind.exe https://kind.sigs.k8s.io/dl/v0.20.0/kind-windows-amd64
Move-Item .\kind.exe "$env:ProgramFiles\Kind"
```

### Create Cluster

```powershell
kind create cluster --name k8s-dashboard
```

### Use

```powershell
kubectl cluster-info
kubectl get nodes
```

---

## Testing with Real Pods

### Deploy Sample Pods

Once you have a cluster running, deploy test pods:

```bash
# Create test namespace
kubectl create namespace testing

# Deploy a simple pod
kubectl run nginx --image=nginx:latest -n testing

# Deploy multiple pods for testing
kubectl create deployment test-api --image=nginx:latest -n testing --replicas=3

# Verify
kubectl get pods -n testing
```

### View in Dashboard

1. Go to **http://localhost:5173**
2. Click **Network** tab
3. Should see pods you just created!

---

## Testing Full Integration

### Test Network Tab

```bash
# 1. Ensure pods are running
kubectl get pods --all-namespaces

# 2. Go to frontend Network tab
# Should see all pods with IPs, nodes, containers

# 3. Click Topology
# Should see pods and services as nodes
```

### Test Security Tab

```bash
# 1. Create test RBAC
kubectl create rolebinding test-admin --clusterrole=cluster-admin --user=test@example.com

# 2. Go to frontend Security tab
# Should see RBAC bindings with admin badge

# 3. Check privileged pods
# (kube-system pods may show privileged)
```

### Test Threats Tab

```bash
# 1. Send test threat to backend
$event = @{
    output = "Test threat from local K8s"
    priority = "High"
    rule = "Test_Local_Cluster"
    time = (Get-Date -AsUTC).ToString("o")
    output_fields = @{ pod = "test-pod"; namespace = "testing" }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/threats/falco" `
    -Method POST `
    -Headers @{"X-API-Key"="your-secret-api-key-change-this";"Content-Type"="application/json"} `
    -Body $event -UseBasicParsing

# 2. Go to frontend Threats tab
# Should see event appear immediately with High priority (orange)
```

---

## Optional: Deploy Falco (For Real Threats)

Falco monitors kernel for security events and sends webhooks.

### Install Falco Helm Chart

```bash
# Add Falco Helm repo
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm repo update

# Install Falco
helm install falco falcosecurity/falco `
  --namespace falco --create-namespace `
  --set falco.grpc.enabled=true `
  --set falco.grpcOutput.enabled=true
```

### Configure Falco Webhook

```bash
# Port-forward Falco to localhost
kubectl port-forward -n falco svc/falco 5985:5985
```

Add to backend `.env`:
```env
FALCO_ENDPOINT=http://localhost:5985
```

### Send Custom Rules

Falco will detect suspicious behavior in pods (if you trigger them):

```bash
# Deploy a pod that triggers Falco
kubectl run attacker --image=ubuntu:latest -n testing -- sleep 1000

# Connect to pod
kubectl exec -it attacker -n testing -- bash

# Inside pod, try suspicious commands:
cat /etc/shadow        # Falco detects: Sensitive file access
nc -l -p 12345         # Falco detects: Network anomaly
```

---

## Troubleshooting

### Backend can't find K8s cluster

**Error**: "Invalid kube-config file"

**Solution**:
```bash
# Check kubeconfig location
kubectl config view

# Ensure backend can access it
$env:KUBECONFIG = "$env:USERPROFILE\.kube\config"
echo $env:KUBECONFIG
```

### No pods showing in dashboard

**Check**:
```bash
# Verify cluster is running
kubectl get nodes

# Verify pods exist
kubectl get pods --all-namespaces

# Check backend logs
docker logs backend
```

### Minikube port conflicts

**Solution**:
```powershell
# Delete and recreate with different port
minikube delete
minikube start --driver=docker --ports=8001:8000
```

### WSL2 memory issues

**If Minikube crashes**:
```powershell
# Limit WSL2 memory in %USERPROFILE%\.wslconfig:
[wsl2]
memory=8GB
processors=4
```

---

## Quick Commands Reference

### Cluster Management

```bash
# Check cluster status
kubectl cluster-info
kubectl get nodes

# Create namespace
kubectl create namespace testing

# Deploy pod
kubectl run test --image=nginx:latest -n testing

# Get all pods
kubectl get pods --all-namespaces

# Get pod details
kubectl describe pod <pod-name> -n <namespace>

# Delete pod/namespace
kubectl delete pod <pod-name> -n <namespace>
kubectl delete namespace testing
```

### Testing Dashboard

```bash
# 1. Start services
docker compose up

# 2. Open frontend
# http://localhost:5173

# 3. Go to Network tab
# Should see pods from your cluster

# 4. Go to Security tab
# Should see RBAC bindings

# 5. Go to Threats tab
# Should show connection status
```

### Send Test Data

```powershell
# Test threat event
$body = @{
    output = "Test"
    priority = "Warning"
    rule = "Test"
    time = (Get-Date -AsUTC).ToString("o")
    output_fields = @{}
} | ConvertTo-Json

Invoke-WebRequest http://localhost:8000/api/threats/falco -Method POST `
    -Headers @{"X-API-Key"="your-secret-api-key-change-this";"Content-Type"="application/json"} `
    -Body $body -UseBasicParsing
```

---

## Recommended Path

### Quick Testing (15 minutes)

1. ✅ Enable Kubernetes in Docker Desktop
2. ✅ Deploy sample pods
3. ✅ Test frontend Network tab
4. ✅ Send test threats
5. ✅ Verify all tabs work

### Deeper Testing (1 hour)

1. ✅ Deploy multi-pod applications
2. ✅ Test RBAC bindings
3. ✅ Create privileged pods
4. ✅ Test Security tab warnings
5. ✅ Test threat stream
6. ✅ Run full test checklist

### Advanced Testing (2-3 hours)

1. ✅ Install Falco agent
2. ✅ Configure real threat detection
3. ✅ Trigger security rules
4. ✅ Test real event streaming
5. ✅ Performance testing
6. ✅ Load testing

---

## What Data You'll See

### Network Tab (with real cluster)
- All pods from all namespaces
- Pod IPs, nodes, phase
- Container images
- Labels and metadata

### Security Tab (with real cluster)
- Real RBAC bindings
- Service accounts with elevated access
- Privileged kube-system pods (expected)
- Security context analysis

### Threats Tab (with Falco)
- Real security events from kernel
- Process execution monitoring
- File access detection
- Network anomaly detection
- Real-time priority alerts

---

## Next: Testing Checklist

Once cluster is running, follow `TEST_CHECKLIST.md` in backend:

- [ ] Health check
- [ ] API key auth (401/403)
- [ ] Network pods endpoint
- [ ] Network topology endpoint
- [ ] Security RBAC endpoint
- [ ] Security privileged endpoint
- [ ] Threat webhook
- [ ] WebSocket stream
- [ ] Send multiple events
- [ ] Verify all tabs
- [ ] Performance test

---

## Files to Update

### Backend `.env`
```env
# Auto-detects kubeconfig from Docker Desktop or Minikube
# Usually at: ~/.kube/config
KUBECONFIG=~/.kube/config
```

### Frontend `.env.local`
```env
VITE_API_URL=http://localhost:8000
VITE_API_KEY=your-secret-api-key-change-this
```

---

## Support

If you get stuck:

1. **Check cluster is running**:
   ```bash
   kubectl get nodes
   ```

2. **Check backend can connect**:
   ```bash
   docker logs backend | grep -i kubernetes
   ```

3. **Check pods exist**:
   ```bash
   kubectl get pods --all-namespaces
   ```

4. **Restart stack**:
   ```bash
   docker compose down
   docker compose up --build
   ```

---

## Time Estimates

| Task | Time | Complexity |
|------|------|-----------|
| Enable Docker Desktop K8s | 3 min | Easy |
| Deploy sample pods | 2 min | Easy |
| Test Network tab | 2 min | Easy |
| Test all tabs | 5 min | Easy |
| Send test threat | 2 min | Easy |
| Install Minikube | 10 min | Medium |
| Install Falco | 15 min | Medium |
| Full integration test | 30 min | Hard |

**Total for quick test**: ~15 minutes
**Total for complete test**: ~1 hour

---

## Ready to Proceed?

Start with **Option 1: Docker Desktop Kubernetes** (easiest).

Let me know when:
1. ✅ Cluster is running (`kubectl get nodes`)
2. ✅ Pods are deployed (`kubectl get pods`)
3. ✅ Frontend shows data

Then we'll run the full test suite!

