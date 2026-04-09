from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from backend.ai_logic import search_movies

app=FastAPI(title="Movie Semantic Search API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Movie Semantic Search API is running perfectly!"}

