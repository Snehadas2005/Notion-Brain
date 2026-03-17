from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class Node(BaseModel):
    id: str
    label: str
    type: str  # e.g., 'page', 'database'
    properties: Dict[str, Any]
    cluster: Optional[int] = 0

class Edge(BaseModel):
    source: str
    target: str
    type: str  # e.g., 'relation', 'mention'

class GraphData(BaseModel):
    nodes: List[Node]
    edges: List[Edge]

class PageDetail(BaseModel):
    id: str
    title: str
    content: str
    url: str
    properties: Dict[str, Any]
