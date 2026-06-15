from pydantic import BaseModel, Field
from typing import Literal, Optional


class ConnectionConfig(BaseModel):
	"""Configuration for connecting to a Kubernetes cluster.

	mode: one of 'kubeconfig', 'token', or 'incluster'.
	- kubeconfig: provide `kubeconfig` (raw YAML) or `kubeconfig_path`.
	- token: provide `server` (API server URL) and `token` (bearer token).
	- incluster: run inside a cluster and use the serviceaccount mounted credentials.
	"""

	mode: Literal["kubeconfig", "token", "incluster"] = Field(
		"kubeconfig", description="Connection mode"
	)
	kubeconfig: Optional[str] = Field(
		None, description="Raw kubeconfig YAML (use instead of a file)"
	)
	kubeconfig_path: Optional[str] = Field(
		None, description="Path to a kubeconfig file on disk"
	)
	server: Optional[str] = Field(None, description="API server URL (token mode)")
	token: Optional[str] = Field(None, description="Bearer token (token mode)")
	ca_cert: Optional[str] = Field(
		None, description="CA certificate PEM (optional for token mode)"
	)
	namespace: Optional[str] = Field("default", description="Cluster namespace")
