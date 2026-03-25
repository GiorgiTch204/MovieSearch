import pandas as pd
from sentence_transformers import SentenceTransformer
import chromadb

# ჩავტვირთავ მონაცემებს
def load_data():
    df=pd.read_csv("../data/tmdb_5000_movies.csv")
    
    # ვიყენებ მხოლოდ საჭირო სვეტებს და ვშლი ცარიელ სტრიქონებს
    df=df[["id", "original_title", "overview"]].dropna()
    return df

df=load_data()
print(f"ჩაიტვირთა {len(df)} ფილმი.")

print("AI მოდელი იტვირთება...")
model=SentenceTransformer("all-MiniLM-L6-v2")

chroma_client=chromadb.Client()
collection=chroma_client.create_collection(name="movies_collection")

print("მიმდინარეობს ვექტორიზაცია და ბაზაში შენახვა...")
titles=df['original_title'].tolist()[:100]
overview=df["overview"].tolist()[:100]
ids=[str(i) for i in df["id"].tolist()[:100]]

embeddings=model.encode(overview)

collection.add(
    embeddings=embeddings.tolist(),
    documents=overview,
    metadatas=[{"title": t} for t in titles],
    ids=ids
)

print("ბაზა მზადაა! შეგიძლიათ დაიწყოთ ფილმების ძებნა.")

# სატესტო ძებნის მაგალითი
query="A movie about space exploration"
query_embedding=model.encode([query]).tolist()

results=collection.query(
    query_embeddings=query_embedding,
    n_results=3
)

print("\nძებნის შედეგები:")
for i in range(len(results["metadatas"][0])):
    print(f" - {results["metadatas"][0][i]["title"]}")