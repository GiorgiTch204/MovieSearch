import pandas as pd
import chromadb
from sentence_transformers import SentenceTransformer
import os

# ჩავტვირთავ მონაცემებს
def load_data():
    base_dir=os.path.dirname(os.path.abspath(__file__))
    csv_path=os.path.join(base_dir, "..", "data", "tmdb_5000_movies.csv")

    df=pd.read_csv(csv_path)
    df=df[["id", "original_title", "overview"]].dropna()
    return df

print("Data and AI model loading...")
df=load_data()
model=SentenceTransformer("all-MiniLM-L6-v2")

chroma_client=chromadb.Client()
collection=chroma_client.get_or_create_collection(name="movies_collection")

if collection.count()==0:
    print("Now starts the emdedding process. Please wait...")

    
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

    print("DataBase is ready to use!")

def search_movies(query, top_k=5):
    query_embedding=model.encode([query]).tolist()
    results=collection.query(
        query_embeddings=query_embedding,
        n_results=top_k
    )

    return [res["title"] for res in results["metadatas"][0]]

if __name__=="__main__":
    print(search_movies("A movie about love and friendship"))