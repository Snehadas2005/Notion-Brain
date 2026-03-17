# Notion Brain 🧠

A 3D Knowledge Graph explorer for your Notion workspace. Visualize connections, explore clusters, and navigate your thoughts in a cosmic universe.

## Features
- **3D Force Graph**: Interactive visualization of Notion pages and their relations.
- **AI Clustering**: Automatic grouping of related pages based on content similarity.
- **Deep Search**: Quickly find and focus on specific nodes.
- **Notion Integration**: Direct links to your Notion pages and live content fetching.

## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, Three.js (react-force-graph-3d), GSAP.
- **Backend**: FastAPI, NetworkX, Notion SDK, Pydantic.

## Setup

### Backend
1. `cd backend`
2. Create a `.env` file with `NOTION_TOKEN=your_token_here`.
3. `pip install -r requirements.txt`
4. `python main.py`

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## Architecture
```
notion-brain/
├── backend/             # FastAPI + NetworkX
├── frontend/            # React + ForceGraph3D
└── README.md
```
