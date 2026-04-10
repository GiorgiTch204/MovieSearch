import pandas as pd
import chromadb
from sentence_transformers import SentenceTransformer
import os


#load the movie data from the csv file
def load_data():

    #get the current directory of this file
    base_dir=os.path.dirname(os.path.abspath(__file__))

    #build the path to the csv file in the data folder
    csv_path=os.path.join(base_dir, "..", "data", "tmdb_5000_movies.csv")

    #read the csv and remove rows with missing info
    df=pd.read_csv(csv_path)
    df=df[["id", "original_title", "overview"]].dropna()

    return df


#print status and initialize data loading
print("Data and AI model loading...")
df=load_data()


#load the ai model for text embeddings
model=SentenceTransformer("all-MiniLM-L6-v2")


#initialize the chromadb client
chroma_client=chromadb.Client()


#create or get the movie collection in the database
collection=chroma_client.get_or_create_collection(name="movies_collection")


#check if the database needs to be filled
if collection.count()==0:

    #inform the user that embedding is starting
    print("Now starts the emdedding process. Please wait...")

    #prepare the data lists for the database
    titles=df['original_title'].tolist()
    overviews=df["overview"].tolist()
    ids=[str(i) for i in df["id"].tolist()]

    #convert movie descriptions into math vectors
    embeddings=model.encode(overviews)

    #add everything into the vector database
    collection.add(
        embeddings=embeddings.tolist(),
        documents=overviews,
        metadatas=[{"title": t} for t in titles],
        ids=ids
    )

    #print success message
    print("DataBase is ready to use!")


#define the function to search for movies
def search_movies(query, top_k=5):

    #convert the user query into a vector
    query_embedding=model.encode([query]).tolist()

    #search the database for the closest matches
    results=collection.query(
        query_embeddings=query_embedding,
        n_results=top_k
    )

    #return the list of movie titles
    return [res["title"] for res in results["metadatas"][0]]


#run a test search if script is executed directly
if __name__=="__main__":

    #print test results
    print(search_movies("A movie about love and friendship"))