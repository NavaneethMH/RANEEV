from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import routes, websocket
from app.core.database import engine, Base
from app.services.worker_services import start_worker
import asyncio

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="RANEEV API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router, prefix="/api", tags=["api"])
app.add_api_websocket_route("/ws/{user_id}", websocket.websocket_endpoint)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(start_worker())
    print("[SUCCESS] RANEEV backend started successfully!")

@app.get("/")
async def root():
    return {"message": "RANEEV API Running", "version": "1.0.0", "status": "operational"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
