## Installation and Project Setup

Before running the application, it is recommended to create and activate a virtual environment in order to isolate the project dependencies from the global Python environment.

### 1. Create a Virtual Environment

If the virtual environment does not already exist, create it with:

```bash
python -m venv venv
````

### 2. Activate the Virtual Environment

On Windows, activate the virtual environment using:

```bash
venv\Scripts\activate
```

After successful activation, the terminal prompt should display the environment name, for example:

```bash
(venv) D:\Giorgi.Cheishvili\Desktop\MovieSearch>
```

### 3. Install Project Dependencies

Install the required libraries from the `requirements.txt` file:

```bash
python -m pip install -r requirements.txt
```

This command installs all dependencies necessary for running the backend application: FastAPI, Uvicorn, Pandas, ChromaDB, and Sentence-Transformers.

### 4. Run the FastAPI Development Server

To start the backend server, run:

```bash
python -m uvicorn main:app --reload
```

The `--reload` option enables automatic server reloading whenever changes are made to the source code.

Alternatively, on Windows, the server can be started by running:

```bash
run.bat
```

Once the server is running, the API documentation can be accessed at:

```text
http://127.0.0.1:8000/docs
```

The root endpoint can be checked at:

```text
http://127.0.0.1:8000
```

Example search request:

```text
http://127.0.0.1:8000/search?query=space exploration and black holes&limit=10
```

```
```

### Dataset Note

This project uses the **TMDB 5000 Movie Dataset** as the source dataset for movie information.

Dataset link:

```text
https://www.kaggle.com/datasets/tmdb/tmdb-movie-metadata
````

After downloading the dataset, make sure the CSV file is placed in the following location:

```text
data/tmdb_5000_movies.csv
```

The application expects this CSV file to contain the required movie information, especially:

```text
id
original_title
overview
```

The `overview` column is used to generate semantic embeddings with the Sentence-BERT model. These embeddings are then stored locally in ChromaDB.

On the first run, the system may take some time to process the dataset and create the vector database. After this process is completed, the generated ChromaDB files are saved in:

```text
backend/chroma_db/
```

On future runs, the application loads the existing ChromaDB database from disk, so the startup process becomes faster.

If the search results look incorrect or only one movie is returned, delete the generated folder:

```text
backend/chroma_db/
```

Then run the server again. The system will rebuild the vector database from the CSV dataset.

```
```

