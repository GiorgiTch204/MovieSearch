# Movie Semantic Search System

ეს არის საბაკალავრო ნაშრომის ფარგლებში შექმნილი სემანტიკური საძიებო სისტემა.

## როგორ გავუშვათ პროექტი:
1. გადმოწერეთ ფილმების ბაზა [TMDB 5000](https://www.kaggle.com/datasets/tmdb/tmdb-movie-metadata) და ჩააგდეთ `data/` საქაღალდეში.
2. შექმენით ვირტუალური გარემო: `python -m venv venv`
3. დააინსტალირეთ ბიბლიოთეკები: `pip install -r backend/requirements.txt`
4. გაუშვით AI ლოგიკა: `python backend/ai_logic.py`



პროექტის გაშვება:

ბექენდ სერვერის ჩასართავად გამოიყენეთ შემდეგი ბრძანება ტერმინალში:


python -m uvicorn main:app --reload




This project is a movie search application that uses **FastAPI** for the backend and **JavaScript (HTML/CSS)** for the frontend. It allows users to search for movies using natural language (for example: "a movie about love and friendship") by using **AI-powered semantic search**.

Instead of matching exact keywords, the system understands the meaning of text and returns the most relevant movie results.

---

## 🚀 Features

- Semantic movie search (understands meaning, not just keywords)
- FastAPI backend API
- Simple frontend (HTML, CSS, JavaScript)
- AI embeddings using Sentence Transformers
- Vector database using ChromaDB

---

## ⚙️ Requirements

Before running this project, make sure you have:

- Python 3.9 or higher
- pip
- Git

---

## 📥 Setup and Installation

Clone the repository:

```bash
git clone https://github.com/your-username/your-repository-name.git
cd your-repository-name

Create a virtual environment:
py -m venv venv

Activate the virtual environment:
venv\Scripts\activate

Install dependencies:
py -m pip install -r backend/requirements.txt

If you get an SSL certificate error while installing packages, run:
py -m pip install -r backend/requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org


▶️ Running the Application

Start the FastAPI backend server:
py -m uvicorn main:app --reload

If everything works correctly, you will see:
Uvicorn running on http://127.0.0.1:8000

⏳ First Run Behavior

On the first run, the application will:
Load the movie dataset
Load the AI model
Generate embeddings for all movie descriptions

You will see:
Data and AI model loading...
Now starts the embedding process...

This process may take a few minutes. This is normal and only happens once.

🌐 Testing the Backend

Open your browser and go to:
http://127.0.0.1:8000

You should see a confirmation message that the API is running.

You can also test endpoints using Swagger UI:
http://127.0.0.1:8000/docs

💻 Running the Frontend
To use the frontend, you have two options.

Option 1:
Open the file directly:

frontend/index.html

Option 2:

cd frontend
py -m http.server 5500

Then open:
http://127.0.0.1:5500

🔎 How to Use
Start the backend server
Open the frontend
Enter a movie description
Press Enter
View the results

🧠 Example Queries
a movie about love and friendship
dark science fiction story
action movie with heroes
romantic drama

🧠 How It Works
The system works in the following way:
Movie data is loaded from a CSV file
Each movie overview is converted into a numerical vector (embedding) using a pre-trained AI model
All embeddings are stored in a vector database (ChromaDB)
When a user enters a query, it is also converted into a vector
The system finds the most similar vectors
The corresponding movie titles are returned
