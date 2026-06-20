#!/usr/bin/env python3
import os
from dotenv import load_dotenv
from kubernetes_asyncio import client as k8s_client

load_dotenv()

token = os.getenv("K8S_TOKEN")
server = os.getenv("K8S_SERVER")

print(f"Token length: {len(token) if token else 'None'}")
print(f"Server: {server}")

# Try method 1: Using api_key dict assignment
config1 = k8s_client.Configuration()
config1.host = server
config1.verify_ssl = False
config1.api_key = {"authorization": f"Bearer {token}"}

print(f"\nMethod 1 - Using api_key dict assignment:")
print(f"  Config.api_key: {list(config1.api_key.keys())}")
print(f"  Config.api_key_prefix: {config1.api_key_prefix}")

# Check what the REST client would do with this
from kubernetes_asyncio.client import rest
rest_client = rest.RESTClientObject(config1)
print(f"  Default headers: {rest_client.default_headers}")

# Try method 2: Using api_key_prefix and api_key separately
config2 = k8s_client.Configuration()
config2.host = server
config2.verify_ssl = False
config2.api_key_prefix = {"authorization": "Bearer"}
config2.api_key = {"authorization": token}

print(f"\nMethod 2 - Using api_key_prefix + api_key:")
print(f"  Config.api_key: {list(config2.api_key.keys())}")
print(f"  Config.api_key_prefix: {list(config2.api_key_prefix.keys())}")

rest_client2 = rest.RESTClientObject(config2)
print(f"  Default headers: {rest_client2.default_headers}")

