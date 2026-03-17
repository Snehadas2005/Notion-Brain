from fastapi import APIRouter
from services.notion_client import get_all_pages, get_page_blocks
from services.graph_builder import build_graph
from services.ai_cluster import add_semantic_edges

router = APIRouter()

@router.get("/graph")
async def get_graph():
    pages = get_all_pages()
    
    # helper to fetch blocks (sync for now as per user snippet)
    def fetch_blocks(pid):
        return get_page_blocks(pid)
        
    graph = build_graph(pages, fetch_blocks)
    
    # Optional: fetch content for semantic clustering
    # In a real app, you might want to cache this
    page_texts = {}
    for page in pages:
        pid = page["id"]
        blocks = fetch_blocks(pid)
        text = " ".join(
            rt["plain_text"]
            for b in blocks
            for rt in b.get(b.get("type",""), {}).get("rich_text", [])
        )
        page_texts[pid] = text
        
    graph = add_semantic_edges(graph, page_texts)
    
    return graph

@router.get("/page/{page_id}")
async def get_page_detail(page_id: str):
    blocks = get_page_blocks(page_id)
    text = " ".join(
        rt["plain_text"]
        for b in blocks
        for rt in b.get(b.get("type",""), {}).get("rich_text", [])
    )
    return {"id": page_id, "content": text[:1000]}
