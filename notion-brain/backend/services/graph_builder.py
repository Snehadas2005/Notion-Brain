import networkx as nx
import re

def extract_page_links(blocks: list) -> list[str]:
    """Find all internal Notion page IDs linked in a page's content."""
    linked_ids = []
    for block in blocks:
        btype = block.get("type", "")
        rich_texts = block.get(btype, {}).get("rich_text", [])
        for rt in rich_texts:
            mentions = rt.get("mention", {})
            if mentions.get("type") == "page":
                linked_ids.append(mentions["page"]["id"])
    return linked_ids

def build_graph(pages: list, get_blocks_fn) -> dict:
    G = nx.DiGraph()

    for page in pages:
        pid = page["id"]
        title = ""
        # Check standard title property
        title_prop = page.get("properties", {}).get("title", {})
        if title_prop and title_prop.get("title"):
            title = title_prop["title"][0]["plain_text"]
        # Fallback for Database-based pages (usually "Name")
        elif page.get("properties", {}).get("Name", {}).get("title"):
            title = page["properties"]["Name"]["title"][0]["plain_text"]

        G.add_node(pid, label=title or "Untitled", url=page["url"],
                   created=page["created_time"], edited=page["last_edited_time"])

    for page in pages:
        pid = page["id"]
        blocks = get_blocks_fn(pid)
        for linked_id in extract_page_links(blocks):
            if G.has_node(linked_id):
                G.add_edge(pid, linked_id)

    return {
        "nodes": [{"id": n, **G.nodes[n]} for n in G.nodes],
        "links": [{"source": u, "target": v} for u, v in G.edges]
    }
