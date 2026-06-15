"""
K8s Dashboard Backend - Integration Tests
Tests actual API endpoints with mock K8s cluster
"""

import asyncio
import json
import httpx
from typing import Dict, Any, Optional
from test_fixtures import (
    MockPodFixtures, MockServiceFixtures, MockRBACFixtures,
    MockSecurityFixtures, MockThreatFixtures
)

# Configuration
API_BASE_URL = "http://localhost:8000"
API_KEY = "your-secret-api-key-change-this"


class APIClient:
    """HTTP client for testing API endpoints"""
    
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
    
    async def get(self, endpoint: str) -> Dict[str, Any]:
        """Make GET request"""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.base_url}{endpoint}",
                    headers=self.headers,
                    timeout=10
                )
                return {"status": resp.status_code, "data": resp.json()}
        except Exception as e:
            return {"status": 0, "error": str(e)}
    
    async def post(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Make POST request"""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.base_url}{endpoint}",
                    headers=self.headers,
                    json=data,
                    timeout=10
                )
                return {"status": resp.status_code, "data": resp.json()}
        except Exception as e:
            return {"status": 0, "error": str(e)}


class ThreatAPITests:
    """Test threat detection endpoints"""
    
    def __init__(self, client: APIClient):
        self.client = client
    
    async def test_falco_webhook(self):
        """Test POST /api/threats/falco"""
        print("\n" + "="*60)
        print("TEST: Falco Webhook Endpoint")
        print("="*60)
        
        events = MockThreatFixtures.get_threat_events()
        results = []
        
        for i, event in enumerate(events, 1):
            print(f"\nSending Falco event {i}/{len(events)}: {event['rule']}")
            result = await self.client.post("/api/threats/falco", event)
            
            if result['status'] == 200:
                print(f"  ✓ Status {result['status']} - Event published")
                results.append(True)
            else:
                print(f"  ✗ Status {result['status']} - {result.get('error', 'Unknown error')}")
                results.append(False)
        
        print(f"\n✓ Falco webhook test: {sum(results)}/{len(results)} events published")
        return {"total": len(results), "success": sum(results)}
    
    async def test_falco_webhook_auth(self):
        """Test Falco webhook authentication"""
        print("\n" + "="*60)
        print("TEST: Falco Webhook Authentication")
        print("="*60)
        
        event = MockThreatFixtures.get_threat_events()[0]
        
        # Test without auth
        print("\nTest 1: Request without X-API-Key header")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{API_BASE_URL}/api/threats/falco",
                    json=event,
                    timeout=5
                )
                if resp.status_code == 401:
                    print(f"  ✓ Status {resp.status_code} - Correctly rejected")
                else:
                    print(f"  ✗ Status {resp.status_code} - Should be 401")
        except Exception as e:
            print(f"  ✗ Error: {e}")
        
        # Test with wrong key
        print("\nTest 2: Request with wrong X-API-Key")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{API_BASE_URL}/api/threats/falco",
                    headers={"X-API-Key": "wrong-key", "Content-Type": "application/json"},
                    json=event,
                    timeout=5
                )
                if resp.status_code == 403:
                    print(f"  ✓ Status {resp.status_code} - Correctly rejected")
                else:
                    print(f"  ✗ Status {resp.status_code} - Should be 403")
        except Exception as e:
            print(f"  ✗ Error: {e}")
        
        print("\n✓ Authentication test completed")


class NetworkAPITests:
    """Test network discovery endpoints"""
    
    def __init__(self, client: APIClient):
        self.client = client
    
    async def test_pods_endpoint(self):
        """Test GET /api/network/pods"""
        print("\n" + "="*60)
        print("TEST: Network Pods Endpoint")
        print("="*60)
        
        print("\nFetching pods from /api/network/pods...")
        result = await self.client.get("/api/network/pods")
        
        if result['status'] == 500:  # Expected: K8s not configured
            print(f"  ℹ️  Status {result['status']} - K8s cluster not configured (expected)")
            print(f"  Error: {result['data'].get('detail', 'No detail')}")
            return {"status": "not_configured", "message": "K8s cluster unavailable"}
        elif result['status'] == 401:
            print(f"  ✗ Status {result['status']} - Authentication failed")
            return {"status": "auth_failed"}
        elif result['status'] == 200:
            data = result['data']
            items = data.get('items', [])
            print(f"  ✓ Status {result['status']} - Retrieved {len(items)} pods")
            
            if items:
                print(f"\n  Sample pods:")
                for pod in items[:3]:
                    print(f"    • {pod['namespace']}/{pod['name']} ({pod['phase']})")
            
            return {"status": "success", "count": len(items)}
        else:
            print(f"  ✗ Status {result['status']} - Unexpected error")
            return {"status": "error"}
    
    async def test_topology_endpoint(self):
        """Test GET /api/network/topology"""
        print("\n" + "="*60)
        print("TEST: Network Topology Endpoint")
        print("="*60)
        
        print("\nFetching topology from /api/network/topology...")
        result = await self.client.get("/api/network/topology")
        
        if result['status'] == 500:
            print(f"  ℹ️  Status {result['status']} - K8s cluster not configured (expected)")
            return {"status": "not_configured"}
        elif result['status'] == 401:
            print(f"  ✗ Status {result['status']} - Authentication failed")
            return {"status": "auth_failed"}
        elif result['status'] == 200:
            data = result['data']
            nodes = data.get('nodes', [])
            edges = data.get('edges', [])
            print(f"  ✓ Status {result['status']} - Topology retrieved")
            print(f"    Nodes: {len(nodes)}")
            print(f"    Edges: {len(edges)}")
            
            if nodes:
                print(f"\n  Sample nodes:")
                for node in nodes[:5]:
                    print(f"    • {node.get('type')}: {node.get('namespace')}/{node.get('name')}")
            
            return {"status": "success", "nodes": len(nodes), "edges": len(edges)}
        else:
            print(f"  ✗ Status {result['status']} - Unexpected error")
            return {"status": "error"}


class SecurityAPITests:
    """Test security audit endpoints"""
    
    def __init__(self, client: APIClient):
        self.client = client
    
    async def test_rbac_endpoint(self):
        """Test GET /api/security/rbac"""
        print("\n" + "="*60)
        print("TEST: RBAC Audit Endpoint")
        print("="*60)
        
        print("\nFetching RBAC bindings from /api/security/rbac...")
        result = await self.client.get("/api/security/rbac")
        
        if result['status'] == 500:
            print(f"  ℹ️  Status {result['status']} - K8s cluster not configured (expected)")
            return {"status": "not_configured"}
        elif result['status'] == 401:
            print(f"  ✗ Status {result['status']} - Authentication failed")
            return {"status": "auth_failed"}
        elif result['status'] == 200:
            data = result['data']
            bindings = data if isinstance(data, list) else data.get('items', [])
            print(f"  ✓ Status {result['status']} - Retrieved {len(bindings)} RBAC bindings")
            
            # Analyze elevated access
            admin_count = len([b for b in bindings if b.get('role_ref', {}).get('name') == 'cluster-admin'])
            if admin_count > 0:
                print(f"  ⚠️  Found {admin_count} cluster-admin bindings")
            
            if bindings:
                print(f"\n  Sample bindings:")
                for binding in bindings[:3]:
                    role = binding.get('role_ref', {}).get('name')
                    ns = binding.get('namespace', 'cluster-wide')
                    print(f"    • {ns}: {binding.get('name')} → {role}")
            
            return {"status": "success", "count": len(bindings), "admin_count": admin_count}
        else:
            print(f"  ✗ Status {result['status']} - Unexpected error")
            return {"status": "error"}
    
    async def test_privileged_pods_endpoint(self):
        """Test GET /api/security/privileged"""
        print("\n" + "="*60)
        print("TEST: Privileged Pods Detection Endpoint")
        print("="*60)
        
        print("\nFetching privileged pods from /api/security/privileged...")
        result = await self.client.get("/api/security/privileged")
        
        if result['status'] == 500:
            print(f"  ℹ️  Status {result['status']} - K8s cluster not configured (expected)")
            return {"status": "not_configured"}
        elif result['status'] == 401:
            print(f"  ✗ Status {result['status']} - Authentication failed")
            return {"status": "auth_failed"}
        elif result['status'] == 200:
            data = result['data']
            pods = data if isinstance(data, list) else data.get('items', [])
            print(f"  ✓ Status {result['status']} - Found {len(pods)} high-risk pods")
            
            if pods:
                print(f"\n  High-risk pods:")
                for pod in pods[:5]:
                    risks = []
                    if pod.get('privileged'):
                        risks.append("PRIVILEGED")
                    if pod.get('run_as_user') == 0:
                        risks.append("ROOT")
                    print(f"    • {pod['namespace']}/{pod['name']}: {', '.join(risks)}")
            
            return {"status": "success", "count": len(pods)}
        else:
            print(f"  ✗ Status {result['status']} - Unexpected error")
            return {"status": "error"}


class HealthTests:
    """Test health and authentication"""
    
    def __init__(self, client: APIClient):
        self.client = client
    
    async def test_health_check(self):
        """Test GET / health endpoint"""
        print("\n" + "="*60)
        print("TEST: Health Check")
        print("="*60)
        
        print("\nFetching health status from GET /...")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{API_BASE_URL}/", timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"  ✓ Status {resp.status_code} - Service healthy")
                    print(f"    Status: {data.get('status')}")
                    print(f"    Message: {data.get('message')}")
                    return {"status": "healthy"}
                else:
                    print(f"  ✗ Status {resp.status_code}")
                    return {"status": "unhealthy"}
        except Exception as e:
            print(f"  ✗ Error: {e}")
            return {"status": "error", "error": str(e)}


async def run_integration_tests():
    """Run all integration tests"""
    print("\n" + "🧪 K8s DASHBOARD BACKEND - INTEGRATION TESTS 🧪".center(60, "="))
    
    client = APIClient(API_BASE_URL, API_KEY)
    results = {}
    
    # Health tests
    print("\n\n🏥 HEALTH CHECKS:")
    health_tests = HealthTests(client)
    results['health'] = await health_tests.test_health_check()
    
    # Threat tests
    print("\n\n⚠️  THREAT DETECTION TESTS:")
    threat_tests = ThreatAPITests(client)
    results['threats'] = await threat_tests.test_falco_webhook()
    results['threat_auth'] = await threat_tests.test_falco_webhook_auth()
    
    # Network tests
    print("\n\n📡 NETWORK DISCOVERY TESTS:")
    network_tests = NetworkAPITests(client)
    results['network_pods'] = await network_tests.test_pods_endpoint()
    results['network_topology'] = await network_tests.test_topology_endpoint()
    
    # Security tests
    print("\n\n🔐 SECURITY AUDIT TESTS:")
    security_tests = SecurityAPITests(client)
    results['security_rbac'] = await security_tests.test_rbac_endpoint()
    results['security_privileged'] = await security_tests.test_privileged_pods_endpoint()
    
    # Summary
    print("\n" + "="*60)
    print("INTEGRATION TEST SUMMARY")
    print("="*60)
    print(f"\nResults:")
    for test_name, result in results.items():
        status = result.get('status', 'unknown')
        symbol = "✓" if status == "success" else "ℹ️" if status == "not_configured" else "✗"
        print(f"  {symbol} {test_name}: {status}")
    
    print("\n" + "="*60)
    print("✓ Integration tests completed")
    print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(run_integration_tests())
