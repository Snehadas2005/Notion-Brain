from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from notion_client import Client
import math
import os
import httpx
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

# ─────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────
class GraphRequest(BaseModel):
    token: Optional[str] = None
    url:   Optional[str] = None

_node_cache = {}

def _notion(token: str) -> Client:
    return Client(auth=token)

def _extract_text_deep(blocks: list, client: Client, depth: int = 0) -> str:
    """Recursively extract ALL text from blocks including nested children."""
    parts = []
    if depth > 3:  # Limit recursion depth
        return ""
    
    for b in blocks:
        btype = b.get("type", "")
        
        # Extract rich text from this block
        block_data = b.get(btype, {})
        for rt in block_data.get("rich_text", []):
            text = rt.get("plain_text", "").strip()
            if text:
                parts.append(text)
        
        # Handle special block types
        if btype == "child_page":
            title = b.get("child_page", {}).get("title", "")
            if title:
                parts.append(f"[Page: {title}]")
        
        if btype in ("bulleted_list_item", "numbered_list_item", "to_do"):
            for rt in block_data.get("rich_text", []):
                text = rt.get("plain_text", "").strip()
                if text:
                    parts.append(f"• {text}")
        
        if btype == "heading_1" or btype == "heading_2" or btype == "heading_3":
            for rt in block_data.get("rich_text", []):
                text = rt.get("plain_text", "").strip()
                if text:
                    parts.append(f"\n## {text}")
        
        if btype == "callout":
            for rt in block_data.get("rich_text", []):
                text = rt.get("plain_text", "").strip()
                if text:
                    parts.append(f"[!] {text}")
        
        if btype == "quote":
            for rt in block_data.get("rich_text", []):
                text = rt.get("plain_text", "").strip()
                if text:
                    parts.append(f"> {text}")
        
        # Recurse into children if block has them
        if b.get("has_children") and client and depth < 3:
            try:
                child_blocks = client.blocks.children.list(block_id=b["id"]).get("results", [])
                child_text = _extract_text_deep(child_blocks, client, depth + 1)
                if child_text:
                    parts.append(child_text)
            except Exception:
                pass
    
    return "\n".join(filter(None, parts))

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
        results = []
        cursor = None
        while True:
            kwargs = {"block_id": page_id, "page_size": 100}
            if cursor:
                kwargs["start_cursor"] = cursor
            resp = client.blocks.children.list(**kwargs)
            results.extend(resp.get("results", []))
            if not resp.get("has_more"):
                break
            cursor = resp.get("next_cursor")
        return results
    except Exception:
        return []

def _fetch_all_pages(client: Client, limit: int = 40) -> list:
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
            # Check for child_page blocks
            if btype == "child_page":
                target = b.get("id")
                if target in node_ids and target != pid:
                    links.append({"source": pid, "target": target})
                    links_count[pid] += 1
                    links_count[target] += 1
            # Check for mention links in rich text
            for rt in b.get(btype, {}).get("rich_text", []):
                mention = rt.get("mention", {})
                if mention.get("type") == "page":
                    target = mention["page"]["id"]
                    if target in node_ids:
                        links.append({"source": pid, "target": target})
                        links_count[pid] += 1
                        links_count[target] += 1

    # Include ALL nodes (not just connected ones — small workspaces may have isolated pages)
    final_nodes = []
    for pid in node_ids:
        p = page_map[pid]
        final_nodes.append({
            "id":    pid,
            "label": _page_title(p),
            "url":   p.get("url", ""),
            "edited": p.get("last_edited_time", ""),
        })

    valid_ids = {n["id"] for n in final_nodes}
    final_links = [l for l in links if l["source"] in valid_ids and l["target"] in valid_ids]
    return {"nodes": final_nodes, "links": final_links}

def _assign_positions(nodes: list) -> list:
    n = len(nodes)
    for i, node in enumerate(nodes):
        angle  = (i / max(n, 1)) * math.pi * 2
        radius = 15 + (i % 4) * 5
        node["position"] = [
            round(math.cos(angle) * radius, 2),
            round(math.sin(i * 1.5) * 5.0,  2),
            round(math.sin(angle) * radius,  2),
        ]
        node["cluster"] = i % 5
    return nodes

# ─────────────────────────────────────────
# GEMINI API — Uses GEMINI_API_KEY from .env
# Tries multiple models, extracts full page content first
# ─────────────────────────────────────────
async def _summarize_with_gemini_async(text: str, page_title: str = "") -> str:
    """
    Summarize page content using Gemini API from .env GEMINI_API_KEY.
    Returns a rich, structured summary.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return f"[CONFIG_ERROR] GEMINI_API_KEY not set in .env — add it to enable AI summaries.\n\nRaw content:\n{text[:500]}"

    if not text or not text.strip():
        return "[EMPTY_PAGE] This page has no content yet."

    prompt = (
        f"You are analyzing a Notion page titled: '{page_title}'\n\n"
        "Provide a structured, intelligent summary of the following content. "
        "Format your response as:\n"
        "📌 OVERVIEW: [2-3 sentence summary of what this page is about]\n"
        "🔑 KEY POINTS: [3-5 bullet points of the most important information]\n"
        "🏷️ CATEGORY: [single word or short phrase describing the page type, e.g. 'Project Plan', 'Meeting Notes', 'Research']\n\n"
        f"PAGE CONTENT:\n{text[:10000]}"
    )

    models = [
        "gemini-1.5-flash",
        "gemini-1.5-pro"
    ]

    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in models:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/"
                f"models/{model}:generateContent?key={api_key}"
            )
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.4,
                    "maxOutputTokens": 800,
                    "topP": 0.95,
                },
            }
            try:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            result = parts[0].get("text", "").strip()
                            if result:
                                return result
                elif resp.status_code == 400:
                    # Bad request — log and try next
                    error_detail = resp.json().get("error", {}).get("message", "Unknown error")
                    print(f"[GEMINI] Model {model} 400 error: {error_detail}")
                    continue
                elif resp.status_code == 404:
                    print(f"[GEMINI] Model {model} not found, trying next...")
                    continue
                else:
                    print(f"[GEMINI ERROR] {model} -> {resp.status_code}")
                    print(resp.text)
                    continue
            
            except Exception as e:
                print(f"[GEMINI] Exception with model {model}: {str(e)}")
                continue

    return f"DEBUG ERROR: {resp.status_code} {resp.text}"


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
        pages  = _fetch_all_pages(client, limit=40)
        graph  = _build_graph(pages, client)
        graph["nodes"] = _assign_positions(graph["nodes"])
        return graph
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GRAPH_ERROR: {str(e)}")


@router.get("/page/{page_id}")
async def get_page_detail(page_id: str, token: str = ""):
    """
    Fetch full page content from Notion and summarize with Gemini.
    The token is the user's Notion integration token.
    """
    if not token:
        return {"id": page_id, "content": "AUTH_REQUIRED — pass ?token=secret_xxx"}

    cache_key = f"{page_id}:{token[:8]}"
    if cache_key in _node_cache:
        return {"id": page_id, "content": _node_cache[cache_key]}

    try:
        client = _notion(token)
        
        # 1. Get page metadata (title)
        try:
            page_meta = client.pages.retrieve(page_id=page_id)
            page_title = _page_title(page_meta)
        except Exception:
            page_title = "Untitled Page"
        
        # 2. Get ALL blocks with full recursion
        blocks = _get_blocks(client, page_id)
        if not blocks:
            return {"id": page_id, "content": "[EMPTY_PAGE] This Notion page has no content."}
        
        # 3. Deep extract all text content
        raw_text = _extract_text_deep(blocks, client, depth=0)
        
        if not raw_text.strip():
            return {"id": page_id, "content": "[EMPTY_PAGE] Page exists but contains no readable text."}

        # 4. Summarize with Gemini using .env API key
        summary = await _summarize_with_gemini_async(raw_text, page_title)
        
        # Cache the result
        _node_cache[cache_key] = summary
        return {"id": page_id, "content": summary}

    except Exception as e:
        error_msg = str(e)
        if "Could not find page" in error_msg or "unauthorized" in error_msg.lower():
            return {"id": page_id, "content": f"[ACCESS_DENIED] Make sure your Notion integration has access to this page."}
        return {"id": page_id, "content": f"[RETRIEVAL_ERROR] {error_msg[:200]}"}