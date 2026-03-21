"""
services/notion_client.py — Updated to fetch pages from a submitted Notion URL.

The user pastes a Notion URL like:
  https://notion.so/My-Page-Title-abc123def456...
  https://www.notion.so/workspace/Page-Title-<page_id>

We extract the page ID and use the Notion API to:
1. Get the root page metadata
2. Search for all sub-pages linked from it
3. Return them all as a flat list for graph building
"""

import os
import re
from notion_client import Client

_notion_client = None


def get_client() -> Client:
    global _notion_client
    if _notion_client is None:
        token = os.getenv("NOTION_TOKEN")
        if not token:
            raise ValueError("NOTION_TOKEN environment variable not set")
        _notion_client = Client(auth=token)
    return _notion_client


def extract_page_id_from_url(url: str) -> str:
    """
    Extract the 32-char page ID from various Notion URL formats.

    Handles:
      https://notion.so/Page-Title-abc123def456abc123def456abc123de
      https://www.notion.so/workspace/Page-abc123def456abc123def456abc123de
      https://notion.so/abc123def456abc123def456abc123de
    """
    # Try to find 32-char hex at end of URL path (with or without dashes)
    patterns = [
        r"([a-f0-9]{32})(?:\?|$|#)",          # plain 32-char hex
        r"([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})",  # UUID format
        r"-([a-f0-9]{32})(?:\?|$|#|$)",         # hex at end after dash
    ]
    for pattern in patterns:
        match = re.search(pattern, url.lower())
        if match:
            raw = match.group(1).replace("-", "")
            # Format as UUID
            return f"{raw[:8]}-{raw[8:12]}-{raw[12:16]}-{raw[16:20]}-{raw[20:]}"

    raise ValueError(f"Could not extract page ID from URL: {url}")


def get_pages_from_url(url: str) -> list:
    """
    Main entry point: given a Notion page URL, return all related pages
    (the root page + all sub-pages found via BFS through child pages).
    """
    client = get_client()
    page_id = extract_page_id_from_url(url)

    visited = set()
    pages = []
    queue = [page_id]

    while queue:
        pid = queue.pop(0)
        if pid in visited:
            continue
        visited.add(pid)

        try:
            page = client.pages.retrieve(page_id=pid)
            pages.append(page)

            # Find child pages in blocks
            child_pages = _get_child_page_ids(client, pid)
            for child_id in child_pages:
                if child_id not in visited:
                    queue.append(child_id)

        except Exception as e:
            print(f"Warning: could not fetch page {pid}: {e}")
            continue

        # Limit to 30 pages to avoid rate limits
        if len(pages) >= 30:
            break

    return pages


def _get_child_page_ids(client: Client, page_id: str) -> list:
    """Return list of child page IDs linked from blocks of a page."""
    child_ids = []
    try:
        blocks = client.blocks.children.list(block_id=page_id).get("results", [])
        for block in blocks:
            btype = block.get("type", "")
            if btype == "child_page":
                child_ids.append(block["id"])
            # Also check linked pages in rich text mentions
            rich_texts = block.get(btype, {}).get("rich_text", [])
            for rt in rich_texts:
                mention = rt.get("mention", {})
                if mention.get("type") == "page":
                    child_ids.append(mention["page"]["id"])
    except Exception as e:
        print(f"Warning: could not get children of {page_id}: {e}")
    return child_ids


def get_page_blocks(page_id: str) -> list:
    """Return all blocks of a page as a flat list."""
    client = get_client()
    try:
        results = client.blocks.children.list(block_id=page_id).get("results", [])
        return results
    except Exception as e:
        raise RuntimeError(f"Failed to get blocks for {page_id}: {e}")


# ── Legacy: used for demo/dev mode ──
def get_all_pages() -> list:
    """
    Returns all pages in the workspace (requires full integration access).
    Not used in the main URL-based flow — kept for dev/testing.
    """
    client = get_client()
    results = []
    cursor = None
    while True:
        kwargs = {"filter": {"value": "page", "property": "object"}, "page_size": 100}
        if cursor:
            kwargs["start_cursor"] = cursor
        resp = client.search(**kwargs)
        results.extend(resp.get("results", []))
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")
    return results