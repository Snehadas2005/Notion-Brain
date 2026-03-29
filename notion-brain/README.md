# Notion Brain

Notion Brain is an interactive WebGL graph application that visuals your Notion workspace, showing relationships between pages, and allows you to view detailed summaries of each page powered by Gemini API.

## Recent Changes

### 1. Dual-Mode Connection (Easy Mode & Advanced Mode)
The connection panel in `NotionUniverse.jsx` was completely overhauled to support a dual-mode entry system:
* **Advanced Mode (Token Mode)**: Enter your Notion Internal Integration Token to visualize your entire workspace. Securely sends the token to `/api/graph`.
* **Easy Mode (Link Mode)**: Enter a single URL of a shared/public Notion page. The app submits this via the UI to the newly created `/api/load-notion-from-link` endpoint.

### 2. Backend Graph Generation from a Link (`graph.py`)
Several major additions were made to `routes/graph.py` to support Easy Mode:
* **URL Extraction**: Created `_extract_page_id()` to extract Notion page UUIDs out of standard web URLs.
* **Recursive Discovery**: Added `_fetch_subpages_sync` and `_build_graph_from_root` to recursively discover child pages and build a graph tree starting from one specific root page, instead of doing a workspace-wide search.
* **Fallback Token Support**: The detail view `/api/page/{page_id}` now gracefully falls back to the server's `.env` configuration (`NOTION_TOKEN`) if the user is in Link Mode and has not provided a personal API token.

### 3. Markdown Recursion Fix
* Prevented an `asyncio.TimeoutError` from crashing the markdown builder. The depth of recursive child block fetching in `_blocks_to_markdown` was capped (`depth < 2`) so pages with hundreds of nested toggle/list blocks don't freeze the backend response.

## Getting Started

### Backend
1. Generate an Internal Integration Token from Notion.
2. Put the token in `backend/.env` as `NOTION_TOKEN=your_token_here`.
3. Put a Gemini API Key in `backend/.env` as `GEMINI_API_KEY=your_key_here`. 
4. Run `python main.py`

### Frontend
1. Run `npm install` and `npm run dev` in the `frontend` folder.
2. Open the page and paste your Notion token or Page Link to see the universe graph!
