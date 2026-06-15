from kubernetes_asyncio import client as k8s_client
from models.security import RbacBinding, RbacSubject, RbacRoleRef, PrivilegedPod

async def get_rbac(api_client) -> list[RbacBinding]:
    rbac = k8s_client.RbacAuthorizationV1Api(api_client)
    crb = await rbac.list_cluster_role_binding()
    rb = await rbac.list_role_binding_for_all_namespaces()

    bindings = []
    def parse_binding(b, btype):
        return RbacBinding(
            name=b.metadata.name,
            namespace=getattr(b.metadata, "namespace", None),
            subjects=[RbacSubject(kind=s.kind, name=s.name, namespace=getattr(s, "namespace", None)) for s in (b.subjects or [])],
            role_ref=RbacRoleRef(kind=b.role_ref.kind, name=b.role_ref.name, api_group=b.role_ref.api_group),
            binding_type=btype
        )

    bindings.extend([parse_binding(x, "ClusterRoleBinding") for x in (crb.items or [])])
    bindings.extend([parse_binding(x, "RoleBinding") for x in (rb.items or [])])
    return bindings

async def get_privileged_pods(api_client) -> list[PrivilegedPod]:
    v1 = k8s_client.CoreV1Api(api_client)
    pods = await v1.list_pod_for_all_namespaces()

    flagged = []
    for p in pods.items:
        for c in (p.spec.containers or []):
            sc = c.security_context
            if sc and (getattr(sc, "privileged", False) or getattr(sc, "run_as_user", None) == 0):
                flagged.append(PrivilegedPod(
                    name=p.metadata.name,
                    namespace=p.metadata.namespace,
                    container=c.name,
                    image=c.image,
                    privileged=getattr(sc, "privileged", False) or False,
                    run_as_user=getattr(sc, "run_as_user", None)
                ))
    return flagged
