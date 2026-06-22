import pandas as pd
import chromadb
from sentence_transformers import SentenceTransformer
import os

def load_data():

    base_dir=os.path.dirname(os.path.abspath(__file__))
    csv_path=os.path.join(base_dir, "..", "data", "tmdb_5000_movies.csv")

    df=pd.read_csv(csv_path)
    df=df[["id", "original_title", "overview"]].dropna()

    return df


print("Data and AI model loading...")

df=load_data()

model=SentenceTransformer("all-MiniLM-L6-v2")

base_dir=os.path.dirname(os.path.abspath(__file__))

db_path=os.path.join(base_dir, "chroma_db")

chroma_client=chromadb.PersistentClient(path=db_path)

collection=chroma_client.get_or_create_collection(name="movies_collection")

if collection.count()==0:

    print("Now starts the embedding process. Please wait...")

    titles=df['original_title'].tolist()
    overviews=df["overview"].tolist()
    ids=[str(i) for i in df["id"].tolist()]

    embeddings=model.encode(overviews)

    collection.add(
        embeddings=embeddings.tolist(),
        documents=overviews,
        metadatas=[{"title": t} for t in titles],
        ids=ids
    )

    print("Database is filled and saved to disk!")

else:
    print(f"Database loaded from disk! Total movies: {collection.count()}")

def search_movies(query, top_k=5):
    query_embedding = model.encode([query]).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k
    )

    formatted_results = []
    
    for i in range(len(results["ids"][0])):
        formatted_results.append({
            "title": results["metadatas"][0][i]["title"],
            "overview": results["documents"][0][i]
        })

    return formatted_results