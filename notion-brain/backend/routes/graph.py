"""
Backend: routes/graph.py
Accepts POST { "token": "secret_xxx" }  ← frontend sends this
Also accepts { "url": "..." }           ← backward compat
No NOTION_TOKEN env var required.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from notion_client import Client
import math

router = APIRouter()


# ── Accept both token and url fields so nothing 422s ───────────────────────
class GraphRequest(BaseModel):
    token: Optional[str] = None   # Notion Integration Token (new)
    url:   Optional[str] = None   # kept for backward compat (ignored)


# ── Per-request Notion client ───────────────────────────────────────────────
def _notion(token: str) -> Client:
    return Client(auth=token)


def _extract_text(blocks: list) -> str:
    parts = []
    for b in blocks:
        btype = b.get("type", "")
        for rt in b.get(btype, {}).get("rich_text", []):
            parts.append(rt.get("plain_text", ""))
    return " ".join(parts)


def _page_title(page: dict) -> str:
    for key in ("title", "Name"):
        prop  = page.get("properties", {}).get(key, {})
        items = prop.get("title") or prop.get("rich_text") or []
        if items:
            t = items[0].get("plain_text", "")
            if t:
                return t
    return "Untitled"


def _get_blocks(client: Client, page_id: str) -> list:
    try:
        return client.blocks.children.list(block_id=page_id).get("results", [])
    except Exception:
        return []


def _fetch_all_pages(client: Client, limit: int = 30) -> list:
    results = []
    cursor  = None
    while len(results) < limit:
        kwargs = {
            "filter":    {"value": "page", "property": "object"},
            "page_size": min(100, limit - len(results)),
        }
        if cursor:
            kwargs["start_cursor"] = cursor
        resp = client.search(**kwargs)
        results.extend(resp.get("results", []))
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")
    return results


def _build_graph(pages: list, client: Client) -> dict:
    node_ids = {p["id"] for p in pages}
    nodes, links = [], []

    for page in pages:
        pid   = page["id"]
        title = _page_title(page)
        nodes.append({
            "id":      pid,
            "label":   title,
            "url":     page.get("url", ""),
            "edited":  page.get("last_edited_time", ""),
        })
        for b in _get_blocks(client, pid):
            btype = b.get("type", "")
            for rt in b.get(btype, {}).get("rich_text", []):
                mention = rt.get("mention", {})
                if mention.get("type") == "page":
                    target = mention["page"]["id"]
                    if target in node_ids:
                        links.append({"source": pid, "target": target})

    return {"nodes": nodes, "links": links}


def _assign_positions(nodes: list) -> list:
    n = len(nodes)
    for i, node in enumerate(nodes):
        if node.get("position"):
            continue
        angle = (i / max(n, 1)) * math.pi * 2
        radius = 8 + (i % 4) * 3
        node["position"] = [
            round(math.cos(angle) * radius, 2),
            round(math.sin(i * 1.3) * 3.5,  2),
            round(math.sin(angle) * radius,  2),
        ]
        node["cluster"] = i % 5
    return nodes


def _add_semantic_edges(graph: dict, page_texts: dict, threshold: float = 0.72) -> dict:
    try:
        from sentence_transformers import SentenceTransformer
        from sklearn.metrics.pairwise import cosine_similarity
        ids = [i for i in page_texts if page_texts[i].strip()]
        if len(ids) < 2:
            return graph
        model = SentenceTransformer("all-MiniLM-L6-v2")
        embs  = model.encode([page_texts[i] for i in ids], show_progress_bar=False)
        sims  = cosine_similarity(embs)
        exist = {(l["source"], l["target"]) for l in graph["links"]}
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                if sims[i][j] > threshold:
                    pair = (ids[i], ids[j])
                    if pair not in exist and (pair[1], pair[0]) not in exist:
                        graph["links"].append({"source": ids[i], "target": ids[j], "semantic": True})
    except Exception:
        pass
    return graph


# ── Main POST endpoint ───────────────────────────────────────────────────────
@router.post("/graph")
async def post_graph(req: GraphRequest):
    token = (req.token or "").strip()

    if not token:
        raise HTTPException(status_code=400, detail="Notion token is required. Send { \"token\": \"secret_...\" }")

    if not (token.startswith("secret_") or token.startswith("ntn_")):
        raise HTTPException(status_code=400, detail="Token must start with 'secret_' or 'ntn_'")

    # Validate token with a lightweight API call
    try:
        client = _notion(token)
        client.users.me()
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Notion token: {str(e)}")

    # Fetch pages
    try:
        pages = _fetch_all_pages(client, limit=30)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch pages: {str(e)}")

    if not pages:
        return {"nodes": [], "links": []}

    graph = _build_graph(pages, client)

    # Semantic similarity edges (optional)
    page_texts = {}
    for page in pages:
        pid = page["id"]
        page_texts[pid] = _extract_text(_get_blocks(client, pid))

    graph = _add_semantic_edges(graph, page_texts)
    graph["nodes"] = _assign_positions(graph["nodes"])

    return graph


# ── GET fallback ─────────────────────────────────────────────────────────────
@router.get("/graph")
async def get_graph_fallback():
    return {
        "nodes": [], "links": [],
        "message": "POST to /api/graph with { \"token\": \"secret_...\" }"
    }


# ── Page detail — token as query param ───────────────────────────────────────
@router.get("/page/{page_id}")
async def get_page_detail(page_id: str, token: str = ""):
    if not token:
        return {"id": page_id, "content": ""}
    try:
        client = _notion(token)
        blocks = _get_blocks(client, page_id)
        return {"id": page_id, "content": _extract_text(blocks)[:2000]}
    except Exception:
        return {"id": page_id, "content": ""}


# ── Legacy search endpoint (404 redirect) ────────────────────────────────────
@router.get("/search")
async def search_pages():
    raise HTTPException(status_code=400, detail="Use POST /api/graph with { \"token\": \"secret_...\" }")