from notion_client import Client
import os

notion = Client(auth=os.getenv("NOTION_API_KEY"))

def get_all_pages():
    results = []
    cursor = None
    while True:
        resp = notion.search(
            filter={"property": "object", "value": "page"},
            start_cursor=cursor
        )
        results.extend(resp["results"])
        if not resp.get("has_more"):
            break
        cursor = resp["next_cursor"]
    return results

def get_page_blocks(page_id: str):
    blocks = notion.blocks.children.list(block_id=page_id)
    return blocks["results"]
