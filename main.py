# ეს კოდი წარმოადგენს FastAPI-ზე აგებულ backend სერვერს, რომელიც უზრუნველყოფს API-ს ფილმების სემანტიკური ძიებისთვის.
# მისი მთავარი მიზანია მიიღოს მომხმარებლის მოთხოვნა (query),
# გადააწოდოს ის AI ლოგიკას და დააბრუნოს შესაბამისი ფილმების სია JSON ფორმატში.

# კოდის დასაწყისში ხდება საჭირო ბიბლიოთეკების იმპორტი.
# FastAPI გამოიყენება API-ს შესაქმნელად, 
# ხოლო Query გამოიყენება მოთხოვნის პარამეტრების სამართავად. 
# CORSMiddleware გამოიყენება იმისთვის, 
# რომ ბრაუზერში გაშვებულმა frontend-მა შეძლოს ამ სერვერთან კომუნიკაცია,
# მიუხედავად იმისა, რომ ისინი სხვადასხვა origin-ზე არიან.
# ასევე ხდება search_movies ფუნქციის იმპორტი backend-ის ai_logic მოდულიდან, რომელიც რეალურად ასრულებს AI-ზე დაფუძნებულ ძიებას.

# შემდეგ იქმნება FastAPI აპლიკაციის ობიექტი, რომელსაც ენიჭება სათაური "Movie Semantic Search API". 
# ეს სათაური გამოიყენება დოკუმენტაციაში და ეხმარება API-ს იდენტიფიცირებაში.

# CORS-ის კონფიგურაცია საშუალებას აძლევს ნებისმიერ origin-ს დაუკავშირდეს ამ API-ს.
# allow_origins=["*"] ნიშნავს, რომ ნებისმიერი დომენიდან შეიძლება მოთხოვნის გაგზავნა.
# ასევე ნებადართულია ყველა HTTP მეთოდი და ჰედერი.
# ეს განსაკუთრებით მნიშვნელოვანია მაშინ, როცა frontend (მაგალითად HTML ან React აპლიკაცია) სხვა სერვერზე ან ლოკაციაზე მუშაობს.

# შემდეგ განსაზღვრულია root endpoint "/", რომელიც გამოიყენება იმის შესამოწმებლად, მუშაობს თუ არა API. 
# როდესაც მომხმარებელი ან ბრაუზერი მიმართავს ამ endpoint-ს, 
# სერვერი აბრუნებს მარტივ JSON პასუხს, რომელიც მიუთითებს, რომ სისტემა გამართულად მუშაობს.

# ძირითადი ფუნქციონალი მოთავსებულია "/search" endpoint-ში. 
# ეს endpoint იღებს ორ პარამეტრს: query, რომელიც წარმოადგენს მომხმარებლის ტექსტურ მოთხოვნას, 
# და limit, რომელიც განსაზღვრავს რამდენი შედეგი უნდა დაბრუნდეს. 
# limit პარამეტრს აქვს default მნიშვნელობა 5, რაც ნიშნავს, რომ თუ მომხმარებელი არ მიუთითებს რაოდენობას, დაბრუნდება ხუთი შედეგი.

# search ფუნქციის შიგნით ხდება search_movies ფუნქციის გამოძახება, 
# რომელსაც გადაეცემა მომხმარებლის query და limit მნიშვნელობა. 
# ეს ფუნქცია იყენებს AI მოდელს და ვექტორულ მონაცემთა ბაზას, რათა იპოვოს ყველაზე შესაბამისი ფილმები.

# ბოლოს, მიღებული შედეგები ბრუნდება JSON ფორმატში, რაც ნიშნავს, 
# რომ frontend-ს შეუძლია მარტივად წაიკითხოს და აჩვენოს ეს მონაცემები მომხმარებლისთვის.

# მთლიანობაში, ეს კოდი წარმოადგენს API ფენას, 
# რომელიც აკავშირებს frontend-ს და AI ლოგიკას. 
# ის უზრუნველყოფს მარტივ და ეფექტურ გზას, რომ მომხმარებელმა გაგზავნოს მოთხოვნა და მიიღოს სემანტიკურად შესაბამისი ფილმების სია.



# imported FastAPI so I can create an API server that handles HTTP requests and responses.
# also imported Query to explicitly define and validate query parameters if needed.
from fastapi import FastAPI, Query

# I import CORSMiddleware so I can allow my frontend to communicate with this backend.
# This is necessary because browsers block requests between different origins unless CORS is enabled.
from fastapi.middleware.cors import CORSMiddleware

# I import my custom search function from my AI logic module.
# I need this because this function actually performs the semantic movie search.
from backend.ai_logic import search_movies

# I create an instance of the FastAPI application.
# I give it a title so it appears clearly in the automatic API documentation.
app = FastAPI(title="Movie Semantic Search API")

# I add CORS middleware to my app.
# I do this so that my frontend (HTML/React) can access this API even if it's hosted on a different origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # I allow all origins so any client can access my API. It's useful for development, but not secure for production.
    allow_methods=["*"],  # I allow all HTTP methods (GET, POST) so I don’t restrict how the API can be used.
    allow_headers=["*"],  # I allow all headers so requests from different clients won’t be blocked.
)

# I define a GET endpoint at the root URL ("/").
# I use this endpoint to check if my API server is running properly.
@app.get("/")
def home():

    # I return a simple JSON response so I can confirm the API is online when I visit this route.
    return {"message": "Movie Semantic Search API is running perfectly!"}

# I define another GET endpoint at "/search".
# I use this endpoint to handle movie search requests from the user.
@app.get("/search")
def search(query: str, limit: int = 5):

    # I call my AI search function and pass the user's query.
    # I also pass the limit (top_k) to control how many results I want back.
    results = search_movies(query, top_k=limit) 

    # I return the search results as JSON so the frontend can easily read and display them.
    return {"results": results}