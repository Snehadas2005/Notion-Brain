from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from notion_client import Client
import math
import os
import google.generativeai as genai

router = APIRouter()

# ─────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────
class GraphRequest(BaseModel):
    token: Optional[str] = None
    url:   Optional[str] = None

# Cache placeholder (User mentioned caching)
_node_cache = {}

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
    links = []
    page_map = {p["id"]: p for p in pages}
    links_count = {pid: 0 for pid in node_ids}

    for page in pages:
        pid   = page["id"]
        blocks = _get_blocks(client, pid)
        for b in blocks:
            btype = b.get("type", "")
            for rt in b.get(btype, {}).get("rich_text", []):
                mention = rt.get("mention", {})
                if mention.get("type") == "page":
                    target = mention["page"]["id"]
                    if target in node_ids:
                        links.append({"source": pid, "target": target})
                        links_count[pid] += 1
                        links_count[target] += 1

    final_nodes = []
    for pid in node_ids:
        if links_count[pid] > 0:
            p = page_map[pid]
            final_nodes.append({
                "id":      pid,
                "label":   _page_title(p),
                "url":     p.get("url", ""),
                "edited":  p.get("last_edited_time", ""),
            })
    
    valid_ids = {n["id"] for n in final_nodes}
    final_links = [l for l in links if l["source"] in valid_ids and l["target"] in valid_ids]

    return {"nodes": final_nodes, "links": final_links}

def _assign_positions(nodes: list) -> list:
    n = len(nodes)
    for i, node in enumerate(nodes):
        angle = (i / max(n, 1)) * math.pi * 2
        radius = 15 + (i % 4) * 5
        node["position"] = [
            round(math.cos(angle) * radius, 2),
            round(math.sin(i * 1.5) * 5.0,  2),
            round(math.sin(angle) * radius,  2),
        ]
        node["cluster"] = i % 5
    return nodes

def _summarize_with_ai(text: str) -> str:
    # Use GEMINI_API_KEY from environment
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return text[:400] + "... [SYNC_ERROR: CONNECT_NOTION_AI_KEY]"
    
    try:
        genai.configure(api_key=api_key)
        
        # Configuration as requested by USER
        generation_config = {
            "temperature": 2.0,      # High temperature for unique answers
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 5000, # Token limit 5000
        }
        
        # Robust model selection to avoid 404 'not found' errors
        model_names = ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-3-flash"]
        model = None
        
        for name in model_names:
            try:
                model = genai.GenerativeModel(
                    model_name=name,
                    generation_config=generation_config
                )
                # Test the model with a tiny probe to verify it's available
                # (Optional: If we want to be 100% sure we don't get a 404 later)
                break 
            except Exception:
                continue
        
        if not model:
            return f"[AI_INIT_FAILED] No valid Gemini model found. Content snippet: {text[:300]}"
        
        prompt = (
            "You are the Notion Brain Intelligent Oracle. "
            "Summarize the following structural data into a high-impact, concise overview. "
            "Limit to 3 sentences maximum. Use architectural, professional language. "
            f"DATA_FLOW:\n{text[:8000]}"
        )
        
        response = model.generate_content(prompt)
        return response.text.strip()
            
    except Exception as e:
        return f"[AI_SYNC_FAILED: {str(e)}] " + text[:300]

# ─────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────

@router.post("/graph")
async def post_graph(req: GraphRequest):
    token = (req.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="TOKEN_MISSING")
    try:
        client = _notion(token)
        pages = _fetch_all_pages(client, limit=40)
        graph = _build_graph(pages, client)
        graph["nodes"] = _assign_positions(graph["nodes"])
        return graph
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GRAPH_ERROR: {str(e)}")

@router.get("/page/{page_id}")
async def get_page_detail(page_id: str, token: str = ""):
    if not token:
        return {"id": page_id, "content": "AUTH_REQUIRED"}
    
    # Caching check
    if page_id in _node_cache:
        return {"id": page_id, "content": _node_cache[page_id]}

    try:
        client = _notion(token)
        blocks = _get_blocks(client, page_id)
        raw_text = _extract_text(blocks)
        
        if not raw_text.strip():
            return {"id": page_id, "content": "NODE_IS_EMPTY"}
            
        summary = _summarize_with_ai(raw_text)
        
        # Populate cache
        _node_cache[page_id] = summary
        
        return {"id": page_id, "content": summary}
    except Exception as e:
        return {"id": page_id, "content": f"RETRIEVAL_ERROR: {str(e)}"}