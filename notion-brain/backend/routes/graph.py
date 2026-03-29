from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from notion_client import Client
import math
import os
import asyncio
import httpx
import re
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

class GraphRequest(BaseModel):
    token: Optional[str] = None
    url:   Optional[str] = None

class LinkRequest(BaseModel):
    page_url: str

_node_cache = {}
_discovered_models = None

_executor = ThreadPoolExecutor(max_workers=4)

NOTION_CALL_TIMEOUT = 20.0


# ─────────────────────────────────────────
# NEW: Page ID extraction from Notion URL
# ─────────────────────────────────────────

def _extract_page_id(url: str) -> Optional[str]:
    """
    Extract Notion page ID from various URL formats:
      - https://www.notion.so/Page-Title-abc123def456...
      - https://www.notion.so/workspace/abc123def456...
      - https://notion.so/abc123def456...
      - Raw 32-char hex IDs (no hyphens)
      - Standard UUID format (with hyphens)
    Returns the page ID as a hyphenated UUID string, or None if not found.
    """
    # Strip query params and fragments
    clean = url.split("?")[0].split("#")[0].rstrip("/")

    # Match 32-char hex at end of URL path (no hyphens)
    match = re.search(r"([0-9a-f]{32})$", clean, re.IGNORECASE)
    if match:
        raw = match.group(1).lower()
        # Insert hyphens: 8-4-4-4-12
        return f"{raw[:8]}-{raw[8:12]}-{raw[12:16]}-{raw[16:20]}-{raw[20:]}"

    # Match UUID format (already hyphenated)
    match = re.search(
        r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
        clean,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).lower()

    return None


# ─────────────────────────────────────────
# NEW: Recursive sub-page fetcher
# ─────────────────────────────────────────

def _fetch_subpages_sync(client: Client, page_id: str, depth: int = 0, max_depth: int = 2) -> list:
    """
    Recursively discover child pages up to max_depth levels.
    Returns a flat list of page objects.
    """
    if depth >= max_depth:
        return []

    discovered = []
    try:
        cursor = None
        while True:
            kwargs = {"block_id": page_id, "page_size": 100}
            if cursor:
                kwargs["start_cursor"] = cursor
            resp = client.blocks.children.list(**kwargs)
            if resp is None:
                break
            blocks = _extract_results(resp)
            for b in blocks:
                bd = _block_to_dict(b) if not isinstance(b, dict) else b
                btype = bd.get("type", "")
                if btype == "child_page":
                    child_id = bd.get("id")
                    if child_id:
                        try:
                            page_meta = client.pages.retrieve(page_id=child_id)
                            discovered.append(page_meta)
                            # Recurse into this child
                            discovered.extend(
                                _fetch_subpages_sync(client, child_id, depth + 1, max_depth)
                            )
                        except Exception:
                            pass
            has_more = resp.get("has_more") if isinstance(resp, dict) else getattr(resp, "has_more", False)
            if not has_more:
                break
            cursor = resp.get("next_cursor") if isinstance(resp, dict) else getattr(resp, "next_cursor", None)
    except Exception as e:
        print(f"[SUBPAGES] Error at depth {depth} for {page_id}: {e}")

    return discovered


# ─────────────────────────────────────────
# NEW: Build graph starting from a single root page
# ─────────────────────────────────────────

async def _build_graph_from_root(root_page_id: str, client: Client) -> dict:
    """
    Fetch root page + all nested sub-pages, then build the graph.
    """
    loop = asyncio.get_event_loop()

    # Fetch root page metadata
    root_page = await asyncio.wait_for(
        loop.run_in_executor(_executor, _fetch_page_meta_sync, client, root_page_id),
        timeout=NOTION_CALL_TIMEOUT,
    )
    if root_page is None:
        raise HTTPException(status_code=404, detail="PAGE_NOT_FOUND — check that the page is shared with the integration")

    # Recursively fetch sub-pages (blocking, run in executor)
    try:
        sub_pages = await asyncio.wait_for(
            loop.run_in_executor(_executor, _fetch_subpages_sync, client, root_page_id, 0, 2),
            timeout=NOTION_CALL_TIMEOUT * 3,
        )
    except asyncio.TimeoutError:
        print("[SUBPAGES] Timeout — using root only")
        sub_pages = []
    except Exception as e:
        print(f"[SUBPAGES] Error: {e}")
        sub_pages = []

    all_pages = [root_page] + sub_pages

    # Deduplicate by ID
    seen = set()
    unique_pages = []
    for p in all_pages:
        pid = _safe_get(p, "id")
        if pid and pid not in seen:
            seen.add(pid)
            unique_pages.append(p)

    print(f"[LINK_MODE] Found {len(unique_pages)} pages from root {root_page_id}")
    return await _build_graph(unique_pages, client)


# ─────────────────────────────────────────
# NEW ENDPOINT: POST /api/load-notion-from-link
# ─────────────────────────────────────────

@router.post("/load-notion-from-link")
async def load_from_link(req: LinkRequest):
    """
    Easy-mode endpoint: accepts a Notion page URL and uses the
    server's NOTION_API_KEY env variable. No user token required.
    """
    # 1. Extract page ID
    page_id = _extract_page_id(req.page_url.strip())
    if not page_id:
        raise HTTPException(
            status_code=400,
            detail="INVALID_URL — could not extract a page ID from the provided link",
        )

    # 2. Load default integration token (fallback to NOTION_TOKEN if NOTION_API_KEY is not set)
    default_token = (os.getenv("NOTION_API_KEY") or os.getenv("NOTION_TOKEN") or "").strip()
    if not default_token:
        raise HTTPException(
            status_code=500,
            detail="SERVER_CONFIG_ERROR — NOTION_API_KEY is not set on the server",
        )

    # 3. Build graph starting from root page
    try:
        client = _notion(default_token)
        graph = await _build_graph_from_root(page_id, client)
        graph["nodes"] = _assign_positions(graph["nodes"])
        return graph
    except HTTPException:
        raise
    except Exception as e:
        err = str(e)
        # Notion 403 / object_not_found → friendly message
        if "object_not_found" in err or "403" in err or "Unauthorized" in err:
            raise HTTPException(
                status_code=403,
                detail="ACCESS_DENIED — please make the page public or share it with the integration",
            )
        raise HTTPException(status_code=500, detail=f"GRAPH_ERROR: {err}")


# ─────────────────────────────────────────
# Unchanged helpers below (kept verbatim)
# ─────────────────────────────────────────

def _notion(token: str) -> Client:
    return Client(auth=token)


def _safe_get(obj, key, default=None):
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _to_dict(obj) -> dict:
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    try:
        return dict(obj)
    except Exception:
        try:
            return vars(obj)
        except Exception:
            return {}


def _rich_text_to_md(rich_text_arr: list) -> str:
    if not rich_text_arr:
        return ""
    result = ""
    for rt in rich_text_arr:
        if isinstance(rt, dict):
            text = rt.get("plain_text", "")
            ann  = rt.get("annotations", {})
            href = rt.get("href") or (rt.get("text", {}) or {}).get("link", {}) or {}
            if isinstance(href, dict):
                href = href.get("url", "")
        else:
            text = getattr(rt, "plain_text", "")
            ann  = _to_dict(getattr(rt, "annotations", {}))
            href = getattr(rt, "href", "")
        if not text:
            continue
        if ann.get("code"):
            text = f"`{text}`"
        if ann.get("bold") and ann.get("italic"):
            text = f"***{text}***"
        elif ann.get("bold"):
            text = f"**{text}**"
        elif ann.get("italic"):
            text = f"*{text}*"
        if ann.get("strikethrough"):
            text = f"~~{text}~~"
        if ann.get("underline"):
            text = f"<u>{text}</u>"
        if href:
            text = f"[{text}]({href})"
        result += text
    return result


def _block_to_dict(b) -> dict:
    if isinstance(b, dict):
        return b
    d = {}
    for attr in ["id", "type", "has_children", "child_page"]:
        val = getattr(b, attr, None)
        if val is not None:
            d[attr] = val
    btype = d.get("type", "")
    if btype:
        raw = getattr(b, btype, None)
        if raw is not None:
            d[btype] = _to_dict(raw) if not isinstance(raw, dict) else raw
    return d


def _blocks_to_markdown(blocks: list, client: Client, depth: int = 0) -> str:
    lines = []
    indent = "  " * depth
    for raw_b in blocks:
        b     = _block_to_dict(raw_b) if not isinstance(raw_b, dict) else raw_b
        btype = b.get("type", "")
        data  = b.get(btype, {}) or {}
        rt    = data.get("rich_text", []) if isinstance(data, dict) else []
        text  = _rich_text_to_md(rt)

        if btype == "heading_1":
            lines.append(f"\n# {text}\n")
        elif btype == "heading_2":
            lines.append(f"\n## {text}\n")
        elif btype == "heading_3":
            lines.append(f"\n### {text}\n")
        elif btype == "paragraph":
            lines.append(f"{indent}{text}" if text else "")
        elif btype == "bulleted_list_item":
            lines.append(f"{indent}- {text}")
        elif btype == "numbered_list_item":
            lines.append(f"{indent}1. {text}")
        elif btype == "to_do":
            checked = data.get("checked", False) if isinstance(data, dict) else False
            lines.append(f"{indent}- [{'x' if checked else ' '}] {text}")
        elif btype == "quote":
            lines.append(f"{indent}> {text}")
        elif btype == "callout":
            emoji = (data.get("icon", {}) or {}).get("emoji", "💡") if isinstance(data, dict) else "💡"
            lines.append(f"{indent}> {emoji} **{text}**")
        elif btype == "code":
            lang = data.get("language", "") if isinstance(data, dict) else ""
            lines.append(f"\n```{lang}\n{text}\n```\n")
        elif btype == "divider":
            lines.append("\n---\n")
        elif btype == "toggle":
            lines.append(f"{indent}▶ **{text}**")
        elif btype == "child_page":
            title = (b.get("child_page") or {}).get("title", "Untitled")
            lines.append(f"{indent}📄 **{title}**")
        elif btype == "table_row":
            cells = data.get("cells", []) if isinstance(data, dict) else []
            row_text = " | ".join(_rich_text_to_md(cell) for cell in cells)
            lines.append(f"| {row_text} |")

        if b.get("has_children") and client:
            try:
                child_resp = client.blocks.children.list(block_id=b["id"])
                child_blocks = _extract_results(child_resp)
                child_md = _blocks_to_markdown(child_blocks, client, depth + 1)
                if child_md:
                    lines.append(child_md)
            except Exception:
                pass

    return "\n".join(lines)


def _extract_results(resp) -> list:
    if resp is None:
        return []
    if isinstance(resp, dict):
        return resp.get("results", []) or []
    return getattr(resp, "results", []) or []


def _extract_text_deep(blocks: list, client: Client, depth: int = 0) -> str:
    parts = []
    if depth > 3:
        return ""
    for raw_b in blocks:
        b      = _block_to_dict(raw_b) if not isinstance(raw_b, dict) else raw_b
        btype  = b.get("type", "")
        bdata  = b.get(btype, {}) or {}
        rt     = bdata.get("rich_text", []) if isinstance(bdata, dict) else []
        for item in rt:
            text = (item.get("plain_text", "") if isinstance(item, dict) else getattr(item, "plain_text", "")).strip()
            if text:
                parts.append(text)
        if btype == "child_page":
            title = (b.get("child_page") or {}).get("title", "")
            if title:
                parts.append(f"[Page: {title}]")
        if b.get("has_children") and client and depth < 3:
            try:
                child_resp   = client.blocks.children.list(block_id=b["id"])
                child_blocks = _extract_results(child_resp)
                parts.append(_extract_text_deep(child_blocks, client, depth + 1))
            except Exception:
                pass
    return "\n".join(filter(None, parts))


def _page_title(page) -> str:
    if page is None:
        return "Untitled"
    props = _safe_get(page, "properties") or {}
    if not isinstance(props, dict):
        props = _to_dict(props)
    for key in ("title", "Name"):
        prop = props.get(key, {}) or {}
        if not isinstance(prop, dict):
            prop = _to_dict(prop)
        items = prop.get("title") or prop.get("rich_text") or []
        if items:
            first = items[0]
            t = first.get("plain_text", "") if isinstance(first, dict) else getattr(first, "plain_text", "")
            if t:
                return t
    return "Untitled"


def _get_blocks_sync(client: Client, page_id: str) -> list:
    try:
        results = []
        cursor  = None
        while True:
            kwargs = {"block_id": page_id, "page_size": 100}
            if cursor:
                kwargs["start_cursor"] = cursor
            resp = client.blocks.children.list(**kwargs)
            if resp is None:
                break
            batch = _extract_results(resp)
            results.extend(batch)
            has_more = resp.get("has_more") if isinstance(resp, dict) else getattr(resp, "has_more", False)
            if not has_more:
                break
            cursor = resp.get("next_cursor") if isinstance(resp, dict) else getattr(resp, "next_cursor", None)
        return results
    except Exception as e:
        print(f"[BLOCKS] Exception for {page_id}: {e}")
        return []


def _fetch_all_pages_sync(client: Client, limit: int = 40) -> list:
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
        batch = _extract_results(resp)
        results.extend(batch)
        has_more = resp.get("has_more") if isinstance(resp, dict) else getattr(resp, "has_more", False)
        if not has_more:
            break
        cursor = resp.get("next_cursor") if isinstance(resp, dict) else getattr(resp, "next_cursor", None)
    return results


def _fetch_page_meta_sync(client: Client, page_id: str):
    return client.pages.retrieve(page_id=page_id)


async def _get_blocks(client: Client, page_id: str) -> list:
    loop = asyncio.get_event_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(_executor, _get_blocks_sync, client, page_id),
            timeout=NOTION_CALL_TIMEOUT
        )
    except asyncio.TimeoutError:
        print(f"[BLOCKS] Timeout fetching blocks for {page_id}")
        return []
    except Exception as e:
        print(f"[BLOCKS] Async wrapper error for {page_id}: {e}")
        return []


async def _fetch_all_pages(client: Client, limit: int = 40) -> list:
    loop = asyncio.get_event_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(_executor, _fetch_all_pages_sync, client, limit),
            timeout=NOTION_CALL_TIMEOUT * 2
        )
    except asyncio.TimeoutError:
        print("[PAGES] Timeout fetching all pages")
        return []
    except Exception as e:
        print(f"[PAGES] Async wrapper error: {e}")
        return []


async def _fetch_page_meta(client: Client, page_id: str):
    loop = asyncio.get_event_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(_executor, _fetch_page_meta_sync, client, page_id),
            timeout=NOTION_CALL_TIMEOUT
        )
    except asyncio.TimeoutError:
        print(f"[PAGE_META] Timeout for {page_id}")
        return None
    except Exception as e:
        print(f"[PAGE_META] Async wrapper error for {page_id}: {e}")
        return None


async def _build_graph(pages: list, client: Client) -> dict:
    node_ids = {_safe_get(p, "id") for p in pages}
    links    = []
    page_map = {_safe_get(p, "id"): p for p in pages}

    sem = asyncio.Semaphore(6)

    async def fetch_one(page):
        pid = _safe_get(page, "id")
        async with sem:
            return pid, await _get_blocks(client, pid)

    results = await asyncio.gather(*[fetch_one(p) for p in pages], return_exceptions=True)

    for item in results:
        if isinstance(item, Exception):
            continue
        pid, blocks = item
        for raw_b in blocks:
            b     = _block_to_dict(raw_b) if not isinstance(raw_b, dict) else raw_b
            btype = b.get("type", "")
            if btype == "child_page":
                target = b.get("id")
                if target in node_ids and target != pid:
                    links.append({"source": pid, "target": target})
            bdata = b.get(btype, {}) or {}
            for rt in (bdata.get("rich_text", []) if isinstance(bdata, dict) else []):
                mention = (rt.get("mention", {}) if isinstance(rt, dict) else {}) or {}
                if mention.get("type") == "page":
                    target = (mention.get("page") or {}).get("id")
                    if target and target in node_ids:
                        links.append({"source": pid, "target": target})

    final_nodes = []
    for pid in node_ids:
        if pid is None:
            continue
        p = page_map[pid]
        final_nodes.append({
            "id":     pid,
            "label":  _page_title(p),
            "url":    _safe_get(p, "url") or "",
            "edited": _safe_get(p, "last_edited_time") or "",
        })
    valid_ids   = {n["id"] for n in final_nodes}
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


PREFERRED_KEYWORDS = [
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash",
    "gemini-3.1-flash",
    "gemini-3-flash-lite",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
    "gemini-3.1-pro",
    "gemini-3-pro",
    "gemma-3",
]

MAX_RETRIES        = 2
BASE_DELAY         = 2.0
PER_MODEL_TIMEOUT  = 12.0
GEMINI_TOTAL_CAP   = 30.0


async def _discover_models(api_key: str) -> list[str]:
    global _discovered_models
    if _discovered_models is not None:
        return _discovered_models
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(connect=8.0, read=12.0, write=5.0, pool=5.0)) as http:
            resp = await http.get(
                f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}&pageSize=200"
            )
            if resp.status_code != 200:
                _discovered_models = PREFERRED_KEYWORDS
                return _discovered_models
            all_models = resp.json().get("models", [])
            gen_models = [
                m["name"].replace("models/", "")
                for m in all_models
                if "generateContent" in m.get("supportedGenerationMethods", [])
            ]
            ordered = []
            for kw in PREFERRED_KEYWORDS:
                for m in gen_models:
                    if kw in m and m not in ordered:
                        ordered.append(m)
            for m in gen_models:
                if m not in ordered:
                    ordered.append(m)
            _discovered_models = ordered if ordered else PREFERRED_KEYWORDS
            print(f"[GEMINI] Model order: {_discovered_models[:5]}")
            return _discovered_models
    except Exception as e:
        print(f"[GEMINI] ListModels failed: {e}")
        _discovered_models = PREFERRED_KEYWORDS
        return _discovered_models


async def _call_model(http: httpx.AsyncClient, model: str, api_key: str, prompt: str) -> str | None:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/"
        f"models/{model}:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 1.0, "maxOutputTokens": 3000, "topP": 0.95},
    }
    delay = BASE_DELAY
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = await asyncio.wait_for(http.post(url, json=payload), timeout=PER_MODEL_TIMEOUT)
        except (asyncio.TimeoutError, httpx.TimeoutException):
            print(f"[GEMINI] Timeout {model} attempt {attempt}")
            return None
        if resp.status_code == 200:
            data       = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                if candidates[0].get("finishReason") == "SAFETY":
                    raise ValueError("⚠️ Content flagged by safety filters.")
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts and parts[0].get("text", "").strip():
                    print(f"[GEMINI] ✓ {model}")
                    return parts[0]["text"].strip()
            return None
        elif resp.status_code == 429:
            print(f"[GEMINI] 429 {model} attempt {attempt} — skip")
            if attempt == MAX_RETRIES:
                return None
            await asyncio.sleep(delay)
            delay *= 2
        elif resp.status_code == 404:
            print(f"[GEMINI] 404 {model} — not available")
            return None
        else:
            print(f"[GEMINI] {resp.status_code} {model}")
            return None
    return None


async def _summarize_with_gemini_async(text: str, page_title: str) -> str | None:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or not text.strip():
        return None
    models = await _discover_models(api_key)
    if not models:
        return None
    prompt = (
        f"You are analyzing a Notion page titled: '{page_title}'\n\n"
        "Provide a structured summary.\n"
        "Format:\n"
        "📌 OVERVIEW: [2-3 sentence summary]\n"
        "🔑 KEY POINTS:\n• [point 1]\n• [point 2]\n• [point 3]\n"
        f"🏷️ CATEGORY: [page type]\n\nPAGE CONTENT:\n{text[:3000]}"
    )
    try:
        async with asyncio.timeout(GEMINI_TOTAL_CAP):
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(connect=8.0, read=PER_MODEL_TIMEOUT, write=5.0, pool=5.0)
            ) as http:
                for model in models[:5]:
                    try:
                        result = await _call_model(http, model, api_key, prompt)
                        if result:
                            return result
                    except ValueError as e:
                        return str(e)
    except asyncio.TimeoutError:
        print(f"[GEMINI] Total cap exceeded ({GEMINI_TOTAL_CAP}s) — falling back to raw")
    return None


# ─────────────────────────────────────────
# EXISTING ENDPOINTS (unchanged)
# ─────────────────────────────────────────

@router.post("/graph")
async def post_graph(req: GraphRequest):
    token = (req.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="TOKEN_MISSING")
    try:
        client = _notion(token)
        pages  = await _fetch_all_pages(client, limit=40)
        graph  = await _build_graph(pages, client)
        graph["nodes"] = _assign_positions(graph["nodes"])
        return graph
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GRAPH_ERROR: {str(e)}")


@router.get("/page/{page_id}")
async def get_page_detail(page_id: str, token: str = ""):
    if not token:
        # Try default token for easy-mode sessions
        token = (os.getenv("NOTION_API_KEY") or os.getenv("NOTION_TOKEN") or "").strip()
    if not token:
        return {"id": page_id, "content": "AUTH_REQUIRED", "is_raw": False}

    cache_key = f"{page_id}:{token[:8]}"
    if cache_key in _node_cache:
        c = _node_cache[cache_key]
        return {"id": page_id, "content": c["content"], "raw_content": c.get("raw_content", ""), "is_raw": c["is_raw"]}

    client     = _notion(token)
    page_title = "Untitled Page"

    try:
        page_meta = await _fetch_page_meta(client, page_id)
        if page_meta is not None:
            page_title = _page_title(page_meta)
        else:
            print(f"[PAGE_META] None for {page_id}")
    except Exception as e:
        print(f"[PAGE_META] Error: {e}")

    blocks = await _get_blocks(client, page_id)
    if not blocks:
        result = {
            "content": "[EMPTY_PAGE] No content found or integration lacks access.\n\nMake sure your Notion integration is added to this page via Share → Connections.",
            "raw_content": "",
            "is_raw": False
        }
        _node_cache[cache_key] = result
        return {"id": page_id, **result}

    loop = asyncio.get_event_loop()
    try:
        raw_md = await asyncio.wait_for(
            loop.run_in_executor(_executor, _blocks_to_markdown, blocks, client, 0),
            timeout=NOTION_CALL_TIMEOUT
        )
    except (asyncio.TimeoutError, Exception) as e:
        print(f"[MARKDOWN] Error: {e}")
        raw_md = ""

    if not raw_md.strip():
        try:
            raw_md = await asyncio.wait_for(
                loop.run_in_executor(_executor, _extract_text_deep, blocks, client, 0),
                timeout=NOTION_CALL_TIMEOUT
            )
        except (asyncio.TimeoutError, Exception) as e:
            print(f"[EXTRACT] Error: {e}")
            raw_md = "[Could not parse page content]"

    gemini_summary = None
    try:
        plain_text = await asyncio.wait_for(
            loop.run_in_executor(_executor, _extract_text_deep, blocks, client, 0),
            timeout=NOTION_CALL_TIMEOUT
        )
        gemini_summary = await _summarize_with_gemini_async(plain_text, page_title)
    except Exception as e:
        print(f"[GEMINI] Unexpected error: {e}")

    if gemini_summary:
        result = {"content": gemini_summary, "raw_content": raw_md, "is_raw": False}
    else:
        print(f"[FALLBACK] Using raw content for {page_id}")
        result = {"content": raw_md, "raw_content": raw_md, "is_raw": True}

    _node_cache[cache_key] = result
    return {"id": page_id, **result}