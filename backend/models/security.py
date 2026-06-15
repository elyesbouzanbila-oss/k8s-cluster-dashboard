from pydantic import BaseModel
from typing import List, Optional

class RbacSubject(BaseModel):
    kind: str
    name: str
    namespace: Optional[str] = None

class RbacRoleRef(BaseModel):
    kind: str
    name: str
    api_group: str

class RbacBinding(BaseModel):
    name: str
    namespace: Optional[str] = None
    subjects: List[RbacSubject]
    role_ref: RbacRoleRef
    binding_type: str

class PrivilegedPod(BaseModel):
    name: str
    namespace: str
    container: str
    image: str
    privileged: bool
    run_as_user: Optional[int] = None
