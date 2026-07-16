"""Kubernetes security audit service — RBAC bindings and privileged pods."""

from typing import Any, Dict, List


async def get_rbac_bindings(api_client) -> List[Dict[str, Any]]:
    """Query all ClusterRoleBindings and RoleBindings from the K8s API.

    Returns a list of dicts compatible with the frontend's RbacBinding type:
      - name, namespace, binding_type, role_ref, subjects
    """
    from kubernetes_asyncio import client as k8s_client

    rbac = k8s_client.RbacAuthorizationV1Api(api_client)
    bindings: List[Dict[str, Any]] = []

    # ── ClusterRoleBindings (cluster-scoped) ──────────────────────
    crbs = await rbac.list_cluster_role_binding()
    for crb in crbs.items:
        subjects = []
        for s in (crb.subjects or []):
            subjects.append({
                "kind": s.kind,
                "name": s.name,
                "namespace": s.namespace,
            })
        bindings.append({
            "name": crb.metadata.name,
            "namespace": None,
            "binding_type": "ClusterRoleBinding",
            "role_ref": {
                "kind": crb.role_ref.kind,
                "name": crb.role_ref.name,
                "api_group": crb.role_ref.api_group or "",
            },
            "subjects": subjects,
        })

    # ── RoleBindings (namespaced) ─────────────────────────────────
    rbs = await rbac.list_role_binding_for_all_namespaces()
    for rb in rbs.items:
        subjects = []
        for s in (rb.subjects or []):
            subjects.append({
                "kind": s.kind,
                "name": s.name,
                "namespace": s.namespace,
            })
        bindings.append({
            "name": rb.metadata.name,
            "namespace": rb.metadata.namespace,
            "binding_type": "RoleBinding",
            "role_ref": {
                "kind": rb.role_ref.kind,
                "name": rb.role_ref.name,
                "api_group": rb.role_ref.api_group or "",
            },
            "subjects": subjects,
        })

    return bindings


async def get_privileged_pods(api_client) -> List[Dict[str, Any]]:
    """Query all pods and detect privileged containers / root UID.

    Returns a list of dicts compatible with the frontend's PrivilegedPod type:
      - name, namespace, container, image, privileged, run_as_user
    """
    from kubernetes_asyncio import client as k8s_client

    v1 = k8s_client.CoreV1Api(api_client)
    pods = await v1.list_pod_for_all_namespaces(watch=False)

    results: List[Dict[str, Any]] = []
    for p in pods.items:
        ns = p.metadata.namespace
        pod_name = p.metadata.name
        for c in (p.spec.containers or []):
            sec = c.security_context or None
            is_privileged = False
            run_as_user = None

            if sec:
                if sec.privileged is not None:
                    is_privileged = sec.privileged
                if sec.run_as_user is not None:
                    run_as_user = sec.run_as_user

            # Check pod-level security context (applies to all containers
            # unless overridden at the container level)
            pod_sec = p.spec.security_context
            if pod_sec and run_as_user is None:
                if pod_sec.run_as_user is not None:
                    run_as_user = pod_sec.run_as_user
                # runAsNonRoot: true is noted but doesn't affect the check —
                # we only flag containers explicitly running as root (UID 0).

            if is_privileged or run_as_user == 0:
                results.append({
                    "name": pod_name,
                    "namespace": ns,
                    "container": c.name,
                    "image": c.image or "",
                    "privileged": is_privileged,
                    "run_as_user": run_as_user,
                })

    return results
