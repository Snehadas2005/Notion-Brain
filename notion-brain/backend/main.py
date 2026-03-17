from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.graph import router

app = FastAPI(title="Notion Brain API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the graph router
app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Notion Brain API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
