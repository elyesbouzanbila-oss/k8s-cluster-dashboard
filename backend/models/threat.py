from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

class FalcoEvent(BaseModel):
    output: str
    priority: str
    rule: str
    time: str
    output_fields: Dict[str, Any] = Field(default_factory=dict)
