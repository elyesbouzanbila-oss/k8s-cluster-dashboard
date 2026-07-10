import os
import tempfile
from typing import Optional

from connection.models import ConnectionConfig

# Suppress SSL warnings for internal cluster connections
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def _write_temp_ca(ca_cert_pem: str) -> str:
	"""Write a CA certificate PEM to a temp file and return its path."""
	tf = tempfile.NamedTemporaryFile(delete=False, suffix=".ca.crt")
	tf.write(ca_cert_pem.encode())
	tf.flush()
	tf.close()
	return tf.name


def _ensure_kubernetes_available():
	try:
		import kubernetes_asyncio as k8s
		return k8s
	except Exception as exc:  # pragma: no cover - runtime environment
		raise RuntimeError(
			"kubernetes_asyncio is required for cluster connections: install it (pip install kubernetes-asyncio)"
		) from exc


async def create_api_client(conn: ConnectionConfig):
	"""Create and return a configured `kubernetes_asyncio.client.ApiClient`.

	Supports three modes:
	  - 'incluster' : uses in-cluster service account
	  - 'kubeconfig' : loads provided kubeconfig (string or path) or defaults
	  - 'token'      : constructs a client using server+token (+optional ca_cert)
	"""
	k8s = _ensure_kubernetes_available()
	from kubernetes_asyncio import client as k8s_client, config as k8s_config

	if conn.mode == "incluster":
		# Use the serviceaccount mounted credentials
		k8s_config.load_incluster_config()
		return k8s_client.ApiClient()

	if conn.mode == "kubeconfig":
		# Prefer an explicit path, then raw kubeconfig string, then default
		if conn.kubeconfig_path:
			await k8s_config.load_kube_config(config_file=conn.kubeconfig_path)
			return k8s_client.ApiClient()

		if conn.kubeconfig:
			# write kubeconfig to a temp file and load it
			tf = tempfile.NamedTemporaryFile(delete=False, suffix=".yaml")
			try:
				tf.write(conn.kubeconfig.encode())
				tf.flush()
				tf.close()
				await k8s_config.load_kube_config(config_file=tf.name)
				return k8s_client.ApiClient()
			finally:
				try:
					os.unlink(tf.name)
				except Exception:
					pass

		# fallback: load default kubeconfig from ~/.kube/config
		await k8s_config.load_kube_config()
		return k8s_client.ApiClient()

	if conn.mode == "token":
		if not conn.server or not conn.token:
			raise ValueError("`server` and `token` are required for token mode")

		configuration = k8s_client.Configuration()
		configuration.host = conn.server
		configuration.verify_ssl = True
		if conn.ca_cert:
			configuration.ssl_ca_cert = _write_temp_ca(conn.ca_cert)
		elif conn.server and conn.server.startswith("https://"):
			# Internal cluster with self-signed cert — opt-in via env, not default
			if os.getenv("K8S_INSECURE_SKIP_TLS_VERIFY") == "true":
				configuration.verify_ssl = False
			else:
				raise ValueError(
					"K8S_CA_CERT required for https:// servers "
					"(set K8S_INSECURE_SKIP_TLS_VERIFY=true to override)"
				)

		api_client = k8s_client.ApiClient(configuration=configuration)

		# Add the bearer token to the default headers after creating the client
		# This ensures it gets sent with every request
		api_client.default_headers["Authorization"] = f"Bearer {conn.token}"

		return api_client

	raise ValueError(f"unsupported connection mode: {conn.mode}")

