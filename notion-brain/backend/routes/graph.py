from fastapi import APIRouter, HTTPException
from services.notion_client import get_all_pages, get_page_blocks
from services.graph_builder import build_graph
from services.ai_cluster import add_semantic_edges

router = APIRouter()

def extract_text(blocks):
    return " ".join(
        rt["plain_text"]
        for b in blocks
        for rt in b.get(b.get("type", ""), {}).get("rich_text", [])
    )

@router.get("/graph")
async def get_graph():
    try:
        pages = get_all_pages()
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

    page_texts = {}
    for page in pages:
        pid = page["id"]
        blocks = fetch_blocks(pid)
        page_texts[pid] = extract_text(blocks)

    try:
        graph = add_semantic_edges(graph, page_texts)
    except Exception:
        pass  # AI clustering is optional; don't crash if it fails

    return graph

@router.get("/pages")
async def get_pages():
    try:
        pages = get_all_pages()
        return {"pages": [
            {
                "id": p["id"],
                "title": (
                    (p.get("properties", {}).get("title", {}).get("title") or
                     p.get("properties", {}).get("Name", {}).get("title") or [{}])[0]
                    .get("plain_text", "Untitled")
                ),
                "url": p.get("url"),
                "created_time": p.get("created_time"),
                "last_edited_time": p.get("last_edited_time"),
            }
            for p in pages
        ]}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

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
    try:
        pages = get_all_pages()
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    results = []
    for p in pages:
        title = (
            (p.get("properties", {}).get("title", {}).get("title") or
             p.get("properties", {}).get("Name", {}).get("title") or [{}])[0]
            .get("plain_text", "Untitled")
        )
        if q.lower() in title.lower():
            results.append({"id": p["id"], "title": title, "url": p.get("url")})
    return {"results": results}