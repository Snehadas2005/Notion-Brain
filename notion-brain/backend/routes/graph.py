from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from notion_client import Client
import math
import os
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

class GraphRequest(BaseModel):
    token: Optional[str] = None
    url:   Optional[str] = None

_node_cache = {}
_discovered_models = None   # cached after first /models call

def _notion(token: str) -> Client:
    return Client(auth=token)


# ─────────────────────────────────────────
# RAW NOTION → MARKDOWN  (Gemini fallback)
# ─────────────────────────────────────────

def _rich_text_to_md(rich_text_arr: list) -> str:
    result = ""
    for rt in rich_text_arr:
        text = rt.get("plain_text", "")
        if not text:
            continue
        ann = rt.get("annotations", {})
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
        href = rt.get("href") or (rt.get("text", {}).get("link") or {}).get("url")
        if href:
            text = f"[{text}]({href})"
        result += text
    return result

def _blocks_to_markdown(blocks: list, client: Client, depth: int = 0) -> str:
    lines = []
    indent = "  " * depth
    for b in blocks:
        btype = b.get("type", "")
        data  = b.get(btype, {})
        rt    = data.get("rich_text", [])
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
            checked = "x" if data.get("checked") else " "
            lines.append(f"{indent}- [{checked}] {text}")
        elif btype == "quote":
            lines.append(f"{indent}> {text}")
        elif btype == "callout":
            emoji = data.get("icon", {}).get("emoji", "💡")
            lines.append(f"{indent}> {emoji} **{text}**")
        elif btype == "code":
            lang = data.get("language", "")
            lines.append(f"\n```{lang}\n{_rich_text_to_md(rt)}\n```\n")
        elif btype == "divider":
            lines.append("\n---\n")
        elif btype == "toggle":
            lines.append(f"{indent}▶ **{text}**")
        elif btype == "child_page":
            title = b.get("child_page", {}).get("title", "Untitled")
            lines.append(f"{indent}📄 **{title}**")
        elif btype == "table_row":
            cells = data.get("cells", [])
            row_text = " | ".join(_rich_text_to_md(cell) for cell in cells)
            lines.append(f"| {row_text} |")
        elif btype in ("image", "video", "file", "pdf"):
            caption = _rich_text_to_md(data.get("caption", []))
            src_type = data.get("type", "")
            url = data.get(src_type, {}).get("url", "")
            if caption:
                lines.append(f"{indent}📎 *{caption}*")
            elif url:
                lines.append(f"{indent}📎 [attachment]({url})")
        elif btype in ("embed", "bookmark", "link_preview"):
            url = data.get("url", "")
            caption = _rich_text_to_md(data.get("caption", []))
            label = caption or url
            if url:
                lines.append(f"{indent}🔗 [{label}]({url})")
        elif btype == "equation":
            lines.append(f"{indent}$$ {data.get('expression', '')} $$")

        if b.get("has_children") and client:
            try:
                child_blocks = client.blocks.children.list(block_id=b["id"]).get("results", [])
                child_md = _blocks_to_markdown(child_blocks, client, depth + 1)
                if child_md:
                    lines.append(child_md)
            except Exception:
                pass

    return "\n".join(lines)

def _extract_text_deep(blocks: list, client: Client, depth: int = 0) -> str:
    parts = []
    if depth > 3:
        return ""
    for b in blocks:
        btype = b.get("type", "")
        block_data = b.get(btype, {})
        for rt in block_data.get("rich_text", []):
            text = rt.get("plain_text", "").strip()
            if text:
                parts.append(text)
        if btype == "child_page":
            title = b.get("child_page", {}).get("title", "")
            if title:
                parts.append(f"[Page: {title}]")
        if b.get("has_children") and client and depth < 3:
            try:
                child_blocks = client.blocks.children.list(block_id=b["id"]).get("results", [])
                parts.append(_extract_text_deep(child_blocks, client, depth + 1))
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
    for page in pages:
        pid   = page["id"]
        blocks = _get_blocks(client, pid)
        for b in blocks:
            btype = b.get("type", "")
            if btype == "child_page":
                target = b.get("id")
                if target in node_ids and target != pid:
                    links.append({"source": pid, "target": target})
            for rt in b.get(btype, {}).get("rich_text", []):
                mention = rt.get("mention", {})
                if mention.get("type") == "page":
                    target = mention["page"]["id"]
                    if target in node_ids:
                        links.append({"source": pid, "target": target})
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
# MODEL DISCOVERY — call ListModels once,
# cache the real API names forever.
# Priority: highest RPM text models first.
# ─────────────────────────────────────────

# Display names (from your dashboard) → preferred priority order
# Higher RPM = higher priority
PREFERRED_KEYWORDS = [
    "gemini-3.1-flash-lite",   # 15 RPM — highest
    "gemini-2.5-flash-lite",   # 10 RPM
    "gemini-2.5-flash",        # 5 RPM
    "gemini-3-flash",          # 5 RPM
    "gemini-3.1-flash",        # likely available
    "gemini-3-flash-lite",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
    "gemini-3.1-pro",
    "gemini-3-pro",
    "gemma-3",                 # Gemma fallback (30 RPM but less capable)
]


async def _discover_models(api_key: str) -> list[str]:
    """
    Calls GET /v1beta/models, returns actual model IDs that support
    generateContent, sorted by our preferred priority.
    Result is cached in _discovered_models.
    """
    global _discovered_models
    if _discovered_models is not None:
        return _discovered_models

    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.get(
                f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}&pageSize=200"
            )
            if resp.status_code != 200:
                print(f"[GEMINI] ListModels failed {resp.status_code} — will try preferred list blind")
                _discovered_models = PREFERRED_KEYWORDS
                return _discovered_models

            all_models = resp.json().get("models", [])
            # Keep only models that support generateContent
            gen_models = [
                m["name"].replace("models/", "")
                for m in all_models
                if "generateContent" in m.get("supportedGenerationMethods", [])
            ]
            print(f"[GEMINI] ListModels found {len(gen_models)} generateContent models: {gen_models}")

            # Sort: preferred keywords first (matched by substring), rest appended
            ordered = []
            for kw in PREFERRED_KEYWORDS:
                for m in gen_models:
                    if kw in m and m not in ordered:
                        ordered.append(m)
            for m in gen_models:
                if m not in ordered:
                    ordered.append(m)

            _discovered_models = ordered if ordered else gen_models
            print(f"[GEMINI] Model priority order: {_discovered_models}")
            return _discovered_models

    except Exception as e:
        print(f"[GEMINI] ListModels exception: {e}")
        _discovered_models = PREFERRED_KEYWORDS
        return _discovered_models


# ─────────────────────────────────────────
# GEMINI CALL — retries on 429, skips 404
# ─────────────────────────────────────────

MAX_RETRIES = 4
BASE_DELAY  = 3.0


async def _call_model(http: httpx.AsyncClient, model: str, api_key: str, prompt: str) -> str | None:
    """
    Try one model. Returns text on success, None to skip to next model.
    Raises ValueError on hard errors (403, SAFETY).
    """
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/"
        f"models/{model}:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 2.0,
            "maxOutputTokens": 5000,
            "topP": 0.95,
        },
    }

    delay = BASE_DELAY
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = await http.post(url, json=payload)
        except httpx.TimeoutException:
            print(f"[GEMINI] Timeout {model} attempt {attempt}")
            if attempt == MAX_RETRIES:
                return None
            await asyncio.sleep(delay); delay *= 2
            continue

        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                if candidates[0].get("finishReason") == "SAFETY":
                    raise ValueError("⚠️ Content flagged by Gemini safety filters.")
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts and parts[0].get("text", "").strip():
                    print(f"[GEMINI] ✓ Success with {model}")
                    return parts[0]["text"].strip()
            block = data.get("promptFeedback", {}).get("blockReason", "")
            if block:
                raise ValueError(f"⚠️ Blocked: {block}")
            return None

        elif resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            wait = float(retry_after) if retry_after else delay
            print(f"[GEMINI] 429 {model} attempt {attempt}/{MAX_RETRIES} — wait {wait:.1f}s")
            if attempt == MAX_RETRIES:
                return None
            await asyncio.sleep(wait); delay *= 2

        elif resp.status_code == 403:
            msg = resp.json().get("error", {}).get("message", "Forbidden")
            raise ValueError(f"⚠️ API key rejected (403): {msg}")

        elif resp.status_code == 404:
            print(f"[GEMINI] 404 {model} — not available, trying next")
            return None

        else:
            print(f"[GEMINI] {resp.status_code} {model}: {resp.text[:100]}")
            return None

    return None


async def _summarize_with_gemini_async(text: str, page_title: str) -> str | None:
    """
    Tries every available model in priority order.
    Returns summary string, or None if all fail (triggers raw fallback).
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or not text.strip():
        return None

    models = await _discover_models(api_key)
    if not models:
        return None

    prompt = (
        f"You are analyzing a Notion page titled: '{page_title}'\n\n"
        "Provide a structured, intelligent summary.\n"
        "Format:\n"
        "📌 OVERVIEW: [2-3 sentence summary]\n"
        "🔑 KEY POINTS:\n• [point 1]\n• [point 2]\n• [point 3]\n"
        "🏷️ CATEGORY: [page type]\n\n"
        f"PAGE CONTENT:\n{text}"
    )

    async with httpx.AsyncClient(timeout=60.0) as http:
        for model in models:
            try:
                result = await _call_model(http, model, api_key, prompt)
                if result:
                    return result
            except ValueError as e:
                return str(e)  # hard error — show to user

    return None  # all models failed → caller will use raw fallback


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
    if not token:
        return {"id": page_id, "content": "AUTH_REQUIRED", "is_raw": False}

    cache_key = f"{page_id}:{token[:8]}"
    if cache_key in _node_cache:
        c = _node_cache[cache_key]
        return {"id": page_id, "content": c["content"], "raw_content": c.get("raw_content", ""), "is_raw": c["is_raw"]}

    try:
        client = _notion(token)

        try:
            page_meta  = client.pages.retrieve(page_id=page_id)
            page_title = _page_title(page_meta)
        except Exception:
            page_title = "Untitled Page"

        blocks = _get_blocks(client, page_id)
        if not blocks:
            result = {"content": "[EMPTY_PAGE] This Notion page has no content.", "is_raw": False}
            _node_cache[cache_key] = result
            return {"id": page_id, **result}

        # ── Try Gemini ────────────────────────────────────────────
        plain_text     = _extract_text_deep(blocks, client, depth=0)
        
        raw_md = _blocks_to_markdown(blocks, client, depth=0)
        if not raw_md.strip():
            raw_md = plain_text

        gemini_summary = await _summarize_with_gemini_async(plain_text, page_title)

        if gemini_summary:
            result = {"content": gemini_summary, "raw_content": raw_md, "is_raw": False}
        else:
            # ── Fallback: full raw Notion content as markdown ──────
            print(f"[FALLBACK] Returning raw Notion content for {page_id}")
            result = {"content": raw_md, "raw_content": raw_md, "is_raw": True}

        _node_cache[cache_key] = result
        return {"id": page_id, **result}

    except Exception as e:
        error_msg = str(e)
        if "Could not find page" in error_msg or "unauthorized" in error_msg.lower():
            return {"id": page_id, "content": "[ACCESS_DENIED] Make sure your Notion integration has access to this page.", "is_raw": False}
        return {"id": page_id, "content": f"[RETRIEVAL_ERROR] {error_msg[:200]}", "is_raw": False}