# Notion Brain 🧠

A 3D Knowledge Graph explorer for your Notion workspace. Visualize connections, explore clusters, and navigate your thoughts in a cosmic universe.

## Features
- **3D Force Graph**: Interactive visualization of Notion pages and their relations.
- **AI Clustering**: Automatic grouping of related pages based on content similarity.
- **Deep Search**: Quickly find and focus on specific nodes.
- **Notion Integration**: Direct links to your Notion pages and live content fetching.

## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, Three.js (react-force-graph-3d), GSAP.
- **Backend**: FastAPI, NetworkX, Notion SDK, Pydantic, Gemini API.

## 🚀 Deployment (Vercel)

This project is configured for seamless deployment on Vercel. For your team account: **sneha-das-projects-0b8ba843**.

### 1. Backend API (FastAPI)
- **Repo Link**: Connect your repository on Vercel.
- **Root Directory**: Set to `backend`.
- **Environment Variables**:
  - `NOTION_TOKEN`: Your Notion Integration Token.
  - `GEMINI_API_KEY`: Your Google Gemini API Key.
- **Framework Preset**: select `Other` or `Python` (Vercel will detect `vercel.json`).

### 2. Frontend Client (React)
- **Repo Link**: Connect the same repository.
- **Root Directory**: Set to `frontend`.
- **Framework Preset**: `Vite`.
- **Environment Variables**:
  - `VITE_API_URL`: Your deployed Backend URL (e.g., `https://nb-api.vercel.app/api`).
- **Build Command**: `npm run build`.
- **Output Directory**: `dist`.

---

## 🛠️ Local Setup

### Backend
1. `cd backend`
2. Create a `.env` file with your `NOTION_TOKEN` and `GEMINI_API_KEY`.
3. `pip install -r requirements.txt`
4. `python main.py`

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## 🏛️ Architecture & Project Structure

The project follows a decoupled Monorepo architecture for high-performance 3D rendering and asynchronous AI processing.

```bash
notion-brain/
├── backend/                  # FastAPI Application
│   ├── routes/
│   │   └── graph.py          # Core Logic: Graph building & Gemini Summarization
│   ├── main.py               # Entry point and CORS configuration
│   ├── requirements.txt      # Python dependencies
│   └── vercel.json           # Serverless deployment configuration
├── frontend/                 # Vite + React (Three.js)
│   ├── src/
│   │   ├── components/       # Atmospheric React-Three-Fiber modules
│   │   │   ├── NotionUniverse.jsx    # Main HUD and Graph orchestrator
│   │   │   ├── WorldBackground.jsx   # Cosmic background animations
│   │   │   └── MarkdownRenderer.jsx  # AI content parser
│   │   ├── index.css         # Global brutalist typography/styling
│   │   └── main.jsx          # App bootstrapping
│   ├── vite.config.js        # Build and dev server configuration
│   └── vercel.json           # SPA routing & API rewrites
└── README.md
```

### Technical Flow
1. **Synchronization**: The Frontend sends the Notion Integration Secret to the Backend.
2. **Knowledge Graph**: The Backend searches the workspace, extracts relational links between pages, and computes 3D coordinates.
3. **Cosmic Visualization**: `NotionUniverse` renders the dataset using `react-force-graph-3d` with custom Three.js materials.
4. **AI Oracle**: When a node is clicked, the Backend fetches raw content, parses it into Markdown, and uses Google Gemini to generate a structured structured summary.
