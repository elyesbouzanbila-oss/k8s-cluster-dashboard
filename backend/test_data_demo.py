"""K8s Dashboard Backend - Test Fixtures (ASCII-safe)"""

class Fixtures:
    pods = [
        {"name": "api-server-prod-1", "namespace": "production", "ip": "10.244.1.10", "phase": "Running"},
        {"name": "database-backup", "namespace": "production", "ip": "10.244.2.15", "phase": "Running"},
        {"name": "prometheus-0", "namespace": "monitoring", "ip": "10.244.3.20", "phase": "Running"},
        {"name": "redis-cache", "namespace": "production", "ip": "10.244.2.25", "phase": "Running"}
    ]
    
    rbac = [
        {"name": "admin-cluster", "role": "cluster-admin", "subjects": ["admin@company.com"]},
        {"name": "dev-edit", "role": "editor", "subjects": ["developers"]},
        {"name": "contractor", "role": "cluster-admin", "subjects": ["external@contractor.com"], "risk": "high"}
    ]
    
    threats = [
        {"rule": "Suspicious_Process", "priority": "Critical", "container": "api-server"},
        {"rule": "Privilege_Escalation", "priority": "High", "container": "database"},
        {"rule": "Network_Anomaly", "priority": "Medium", "container": "redis"}
    ]

print("\n" + "="*60)
print("TEST DATA: Production Environment Snapshot")
print("="*60)

print("\nPODS ({} total):".format(len(Fixtures.pods)))
for pod in Fixtures.pods:
    print("  - {}/{}: {} ({})".format(pod['namespace'], pod['name'], pod['ip'], pod['phase']))

print("\nRBAC BINDINGS ({} total):".format(len(Fixtures.rbac)))
for rbac in Fixtures.rbac:
    print("  - {}: {} [{}]".format(rbac['name'], rbac['role'], ', '.join(rbac['subjects'])))
    if rbac.get('risk'):
        print("      WARNING: High-risk binding detected!")

print("\nTHREAT EVENTS ({} total):".format(len(Fixtures.threats)))
for threat in Fixtures.threats:
    print("  - [{}] {}: {}".format(threat['priority'], threat['rule'], threat['container']))

print("\n" + "="*60)
print("Ready for integration testing")
print("="*60 + "\n")
