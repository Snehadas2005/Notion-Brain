"""
Backend: routes/graph.py — Updated for dynamic Notion URL input

The frontend POSTs:
  { "url": "https://notion.so/your-page-id" }

And this returns a full graph with 3D positions.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.notion_client import get_pages_from_url, get_page_blocks
from services.graph_builder import build_graph
from services.ai_cluster import add_semantic_edges
import math

router = APIRouter()


class GraphRequest(BaseModel):
    url: str


def extract_text(blocks):
    return " ".join(
        rt["plain_text"]
        for b in blocks
        for rt in b.get(b.get("type", ""), {}).get("rich_text", [])
    )


def assign_3d_positions(nodes: list) -> list:
    """
    Arrange nodes in a circular/spiral layout in 3D space.
    Nodes in the same cluster are grouped closer together.
    """
    # Group by cluster
    clusters = {}
    for n in nodes:
        c = n.get("cluster", 0)
        clusters.setdefault(c, []).append(n)

    result = []
    cluster_centers = {}
    num_clusters = len(clusters)

    # Place cluster centers in a ring
    for i, cluster_id in enumerate(clusters.keys()):
        angle = (i / num_clusters) * math.pi * 2
        cx = math.cos(angle) * 16
        cz = math.sin(angle) * 16
        cy = (i % 3 - 1) * 4
        cluster_centers[cluster_id] = (cx, cy, cz)

    # Place nodes around their cluster center
    for cluster_id, cluster_nodes in clusters.items():
        cx, cy, cz = cluster_centers[cluster_id]
        n = len(cluster_nodes)
        for j, node in enumerate(cluster_nodes):
            if n == 1:
                node["position"] = [cx, cy, cz]
            else:
                angle = (j / n) * math.pi * 2
                radius = 4 + (j % 2) * 2
                node["position"] = [
                    round(cx + math.cos(angle) * radius, 2),
                    round(cy + math.sin(j * 1.3) * 2.5, 2),
                    round(cz + math.sin(angle) * radius, 2),
                ]
            result.append(node)

    return result


@router.post("/graph")
async def get_graph_from_url(req: GraphRequest):
    """
    Main endpoint: accept a Notion page URL, build and return the knowledge graph.
    """
    try:
        pages = get_pages_from_url(req.url)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Notion API error: {str(e)}")

    if not pages:
        return {"nodes": [], "links": []}

    def fetch_blocks(pid):
        try:
            return get_page_blocks(pid)
        except Exception:
            return []

    graph = build_graph(pages, fetch_blocks)

    # Collect page texts for AI clustering
    page_texts = {}
    for page in pages:
        pid = page["id"]
        blocks = fetch_blocks(pid)
        page_texts[pid] = extract_text(blocks)

    # Add semantic edges
    try:
        graph = add_semantic_edges(graph, page_texts)
    except Exception:
        pass

    # Assign 3D positions
    graph["nodes"] = assign_3d_positions(graph["nodes"])

    return graph


# ── Keep the old GET endpoint for backward compat ──
@router.get("/graph")
async def get_graph_default():
    """Fallback: returns empty graph. Use POST /graph with a URL instead."""
    return {"nodes": [], "links": [],
            "message": "POST to /api/graph with { url: 'notion_page_url' }"}


@router.get("/pages")
async def get_pages():
    raise HTTPException(status_code=400, detail="Use POST /api/graph with a Notion URL")


@router.get("/page/{page_id}")
async def get_page_detail(page_id: str):
    try:
        blocks = get_page_blocks(page_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Page not found: {str(e)}")

    text = " ".join(
        rt["plain_text"]
        for b in blocks
        for rt in b.get(b.get("type", ""), {}).get("rich_text", [])
    )
    return {"id": page_id, "content": text[:2000]}


@router.get("/search")
async def search_pages(q: str = ""):
    raise HTTPException(status_code=400, detail="Use POST /api/graph with a Notion URL")