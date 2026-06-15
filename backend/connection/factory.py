import os
import tempfile
from typing import Optional

from connection.models import ConnectionConfig


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
		await k8s_config.load_incluster_config()
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
		# By default verify_ssl is True; if caller provided no CA we allow skipping
		configuration.verify_ssl = bool(conn.ca_cert)

		ca_tmp: Optional[str] = None
		if conn.ca_cert:
			ca_tf = tempfile.NamedTemporaryFile(delete=False)
			try:
				ca_tf.write(conn.ca_cert.encode())
				ca_tf.flush()
				ca_tf.close()
				ca_tmp = ca_tf.name
				configuration.ssl_ca_cert = ca_tmp
			except Exception:
				try:
					os.unlink(ca_tf.name)
				except Exception:
					pass

		configuration.api_key = {"authorization": "Bearer " + conn.token}
		api_client = k8s_client.ApiClient(configuration=configuration)

		# clean up temp CA file if we created one
		if ca_tmp:
			try:
				os.unlink(ca_tmp)
			except Exception:
				pass

		return api_client

	raise ValueError(f"unsupported connection mode: {conn.mode}")

