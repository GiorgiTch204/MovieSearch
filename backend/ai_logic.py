# ეს კოდი წარმოადგენს ფილმების ძიების სისტემას, 
# რომელიც იყენებს ხელოვნურ ინტელექტს იმისათვის, 
# რომ მომხმარებლის ტექსტური მოთხოვნის საფუძველზე მოძებნოს ყველაზე შესაბამისი ფილმები. 
# სისტემა მუშაობს იმ პრინციპით, რომ კითხულობს ფილმების მონაცემებს CSV ფაილიდან, 
# თითოეული ფილმის აღწერას გარდაქმნის რიცხვით ვექტორებად (embeddings), 
# ინახავს ამ ვექტორებს სპეციალურ ვექტორულ მონაცემთა ბაზაში და შემდეგ მომხმარებლის შეკითხვის მიხედვით პოულობს ყველაზე ახლოს მდგომ ფილმებს.

# პროექტში გამოყენებულია რამდენიმე მნიშვნელოვანი ბიბლიოთეკა. 
# pandas გამოიყენება CSV ფაილის წასაკითხად და მონაცემების დასამუშავებლად, 
# chromadb გამოიყენება როგორც ვექტორული მონაცემთა ბაზა, 
# sentence-transformers გამოიყენება ტექსტის ვექტორებად გარდასაქმნელად, 
# ხოლო os გამოიყენება ფაილების გზების სწორად განსასაზღვრად.

# კოდის მუშაობა იწყება load_data ფუნქციით, 
# რომელიც პოულობს CSV ფაილის მდებარეობას, 
# კითხულობს მას და ტოვებს მხოლოდ საჭირო სვეტებს: id, original_title და overview. 
# ასევე იშლება ის ჩანაწერები, სადაც მონაცემები არასრულია. 
# შედეგად მიიღება სუფთა მონაცემთა სტრუქტურა, რომელიც მზად არის შემდგომი დამუშავებისთვის.

# შემდეგ ეტაპზე იტვირთება წინასწარ გაწვრთნილი მოდელი all-MiniLM-L6-v2, 
# რომელიც ტექსტს გარდაქმნის რიცხვით ვექტორებად. 
# ეს ვექტორები ასახავს ტექსტის მნიშვნელობას და საშუალებას იძლევა სხვადასხვა ტექსტებს შორის სემანტიკური მსგავსება განისაზღვროს.

# ამის შემდეგ ინიციალიზდება ChromaDB-ის კლიენტი და იქმნება ან იტვირთება კოლექცია სახელით movies_collection. 
# ეს კოლექცია გამოიყენება ფილმების ვექტორების, აღწერებისა და დამატებითი ინფორმაციის შესანახად.

# თუ კოლექცია ცარიელია, იწყება მონაცემთა ბაზის შევსების პროცესი. 
# ფილმების სათაურები, აღწერები და იდენტიფიკატორები გადადის სიებში, 
# შემდეგ კი აღწერები გარდაიქმნება ვექტორებად მოდელის გამოყენებით. მიღებული ვექტორები, 
# შესაბამისი ტექსტები და მეტამონაცემები ინახება ბაზაში. ეს პროცესი, როგორც წესი, ერთჯერადია და მომავალში ბაზა უკვე მზად იქნება გამოყენებისთვის.

# ძიების ფუნქცია search_movies იღებს მომხმარებლის ტექსტურ მოთხოვნას და top_k პარამეტრს,
# რომელიც განსაზღვრავს რამდენი შედეგი უნდა დაბრუნდეს.
# მოთხოვნა გარდაიქმნება ვექტორად და შემდეგ ხდება ბაზაში მოძიება იმ ვექტორების, 
# რომლებიც ყველაზე ახლოს დგას მოთხოვნის ვექტორთან. 
# საბოლოოდ ფუნქცია აბრუნებს შესაბამისი ფილმების სათაურების სიას.

# თუ ფაილი გაეშვა პირდაპირ, შესრულდება ტესტური ძიება,
# რომელიც აჩვენებს როგორ მუშაობს სისტემა პრაქტიკაში. 
# მაგალითად, თუ მომხმარებელი ეძებს ფილმს სიყვარულისა და მეგობრობის თემაზე, სისტემა დააბრუნებს შესაბამისი შინაარსის მქონე ფილმებს.

# მთლიანობაში, ეს პროექტი წარმოადგენს ხელოვნურ ინტელექტზე დაფუძნებულ ფილმების ძიების სისტემას, 
# რომელიც იყენებს სემანტიკურ ძიებას. 
# ეს ნიშნავს, რომ სისტემა არ ეყრდნობა მხოლოდ სიტყვების პირდაპირ დამთხვევას,
# არამედ ითვალისწინებს ტექსტის მნიშვნელობასაც, რაც ძიებას უფრო ზუსტსა და ეფექტურს ხდის.


# imported pandas so I can read and process the CSV file containing movie data.
# this is needed because my movie information is stored in tabular form.
import pandas as pd

# imported chromadb so I can store and search vector embeddings.
# this is needed because I want to perform semantic similarity search on movie descriptions.
import chromadb

# imported SentenceTransformer so I can use a pre-trained AI model for text embeddings.
# this is needed because the model converts text into numerical vectors that capture meaning.
from sentence_transformers import SentenceTransformer

# imported os so I can work with file paths safely across different systems.
# this is needed because I want to locate my CSV file relative to this Python file.
import os


# defined a function to load movie data from the CSV file.
# this is written as a function to keep the loading logic organized and reusable.
def load_data():

    # got the absolute directory path of the current Python file.
    # this is needed to build the correct path to the CSV file.
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # built the path to the CSV file located inside the data folder.
    # this ensures the dataset can always be found correctly.
    csv_path = os.path.join(base_dir, "..", "data", "tmdb_5000_movies.csv")

    # read the CSV file into a pandas DataFrame and cleaned it.
    # this is needed to keep only useful columns and remove missing data.
    df = pd.read_csv(csv_path)
    df = df[["id", "original_title", "overview"]].dropna()

    # returned the cleaned DataFrame so it can be used elsewhere in the code.
    return df


# printed a message to indicate that initialization has started.
# this helps track program execution in the console.
print("Data and AI model loading...")

# called the load_data function and stored the result.
# this makes the movie data available for the rest of the program.
df = load_data()


# loaded a pre-trained sentence transformer model.
# this is the AI component that converts text into embeddings.
model = SentenceTransformer("all-MiniLM-L6-v2")


# created a ChromaDB client.
# this is needed to interact with the vector database.
chroma_client = chromadb.Client()


# created or retrieved a collection named "movies_collection".
# this is used to store and query movie embeddings.
collection = chroma_client.get_or_create_collection(name="movies_collection")


# checked whether the collection is empty.
# this prevents reprocessing and storing embeddings multiple times.
if collection.count() == 0:

    # printed a message to indicate embedding process is starting.
    # this is useful because the process may take some time.
    print("Now starts the emdedding process. Please wait...")

    # converted the movie titles column into a list.
    # this is needed to store titles as metadata.
    titles = df["original_title"].tolist()

    # converted the overviews column into a list.
    # this is needed because these will be transformed into embeddings.
    overviews = df["overview"].tolist()

    # converted movie ids into strings and stored them in a list.
    # this is required because the database expects string ids.
    ids = [str(i) for i in df["id"].tolist()]

    # encoded all movie overviews into numerical vectors using the AI model.
    # this enables semantic comparison between texts.
    embeddings = model.encode(overviews)

    # added embeddings, documents, metadata, and ids into the database.
    # this prepares the system for fast semantic search.
    collection.add(
        embeddings=embeddings.tolist(),
        documents=overviews,
        metadatas=[{"title": t} for t in titles],
        ids=ids
    )

    # printed a message indicating the database is ready.
    # this confirms that initialization is complete.
    print("DataBase is ready to use!")


# defined a function to search for movies.
# this allows reuse of the search logic in other parts of the project.
def search_movies(query, top_k=5):

    # converted the user query into an embedding vector.
    # this allows comparison with stored embeddings.
    query_embedding = model.encode([query]).tolist()

    # queried the database for the most similar embeddings.
    # this retrieves the closest matching movie descriptions.
    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k
    )

    # extracted and returned movie titles from metadata.
    # this provides a clean result list for the user.
    return [res["title"] for res in results["metadatas"][0]]


# checked if the script is executed directly.
# this allows running a test without affecting other modules.
if __name__ == "__main__":

    # executed a test search and printed the results.
    # this verifies that the system is working correctly.
    print(search_movies("A movie about love and friendship"))