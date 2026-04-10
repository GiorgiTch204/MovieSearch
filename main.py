#import the fastapi framework and query for handling request parameters
from fastapi import FastAPI, Query

#import corsmiddleware to allow the browser to talk to the server
from fastapi.middleware.cors import CORSMiddleware

#import your custom ai logic function from the backend folder
from backend.ai_logic import search_movies

#initialize the fastapi application with a custom title
app = FastAPI(title="Movie Semantic Search API")

#configure cors so your html file can access this api from a different origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

#define the root endpoint to check if the api is online
@app.get("/")
def home():

    #return a simple json message to confirm the server is running
    return {"message": "Movie Semantic Search API is running perfectly!"}

#define the search endpoint that accepts a query and an optional limit
@app.get("/search")
def search(query: str, limit: int = 5):

    #call the ai logic function and pass the user's query and desired number of results
    results = search_movies(query, top_k=limit) 

    #return the list of found movies to the user in json format
    return {"results": results}