<div align="center">

# 🎬 MovieSearch Pro

**Find any movie, even when you only remember a scene.**

A semantic and hybrid movie discovery platform that combines vector similarity search with traditional filters, so you can search by title, director, actor, genre, or a plain-English description like *"a man enters people's dreams to steal secrets"*.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Site-2563eb?style=for-the-badge&logo=vercel&logoColor=white)](https://movie-search-omega-opal.vercel.app/)

![Next.js](https://img.shields.io/badge/Next.js-14%2B-000000?style=flat-square&logo=next.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.10%2B-009688?style=flat-square&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Neon-PostgreSQL%20%2B%20pgvector-00E599?style=flat-square&logo=postgresql&logoColor=white)
![ONNX](https://img.shields.io/badge/ONNX-Runtime-005CED?style=flat-square&logo=onnx&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

[Features](#-features) · [Architecture](#-architecture) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [Project Structure](#-project-structure)

</div>

---

## 📖 Overview

Most movie sites only work if you already know the title. **MovieSearch Pro** is built for the moment you don't: you remember a plot point, a scene, or a vibe, but not the name.

Queries are converted into embeddings with an ONNX model and matched against movie descriptions using `pgvector`. At the same time, fast lexical filters let you narrow results by title, cast, director, year, and genre. The two approaches work together in a single hybrid search pipeline.

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🧠 | **Semantic Scene Search** | ONNX text embeddings and `pgvector` KNN find movies from a premise or scene description. |
| 🔎 | **Lexical Search & Filters** | Instant filtering by title, director, actor, release year, and genre. |
| 🌍 | **Localized Datasets** | TMDB metadata enriched with specialized regional collections, including Georgian cinema archives. |
| 🔐 | **Authentication** | Secure JWT-based auth with bcrypt password hashing. |
| 📌 | **Personal Watchlists** | Save and manage your own list of movies to watch. |
| 🔔 | **Admin Notifications** | Telegram bot and email alerts for registrations and user activity. |
| 📱 | **Modern, Responsive UI** | Dark mode, movie detail modals, responsive grid cards, and a mobile-ready layout. |

---

## 🏗️ Architecture

```mermaid
flowchart TD
    A["🖥️ Next.js Client<br/><i>Vercel</i><br/>Search · Filters · Watchlist · Modals"]
    B["⚡ FastAPI Backend<br/><i>Render</i><br/>Auth · Hybrid Search · Notifications"]
    C["🤖 ONNX Runtime<br/>Text embeddings<br/>Vector normalization"]
    D[("🐘 Neon PostgreSQL<br/>Movies & cast · Users & watchlists<br/>pgvector embeddings")]
    E["📨 Telegram / SMTP<br/>Admin alerts"]

    A -- "HTTP / JSON" --> B
    B -- "Query text" --> C
    C -- "Embedding vector" --> B
    B -- "SQL + vector KNN" --> D
    B -- "Notifications" --> E
```

**Search flow**

1. The client sends a query to the FastAPI backend.
2. The backend encodes the query into a normalized embedding using ONNX Runtime.
3. Neon PostgreSQL runs a vector KNN search via `pgvector`, combined with SQL filters.
4. Ranked results return to the client as JSON.

---

## 🛠️ Tech Stack

<table>
<tr>
<td valign="top" width="33%">

**Frontend**
- [Next.js](https://nextjs.org/) (App Router)
- [Tailwind CSS](https://tailwindcss.com/) / CSS Modules
- [Heroicons](https://heroicons.com/), [Lucide](https://lucide.dev/), custom SVGs
- Hosted on [Vercel](https://vercel.com/)

</td>
<td valign="top" width="33%">

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
- [ONNX Runtime](https://onnxruntime.ai/) and [Hugging Face](https://huggingface.co/) models
- Standard library `urllib`, `smtplib`, `email.mime`
- Hosted on [Render](https://render.com/)

</td>
<td valign="top" width="33%">

**Data**
- [Neon](https://neon.tech/) serverless PostgreSQL
- [`pgvector`](https://github.com/pgvector/pgvector) for vector search
- [TMDB API](https://www.themoviedb.org/) for metadata

</td>
</tr>
</table>

---

## 📁 Project Structure

```text
MovieSearch/
├── backend/
│   ├── analyze_corpus.py      # Corpus and text analysis tools
│   ├── db_config.py           # Database connection and pooling
│   ├── encoder.py             # ONNX embedding generator for scene search
│   ├── ingest_tmdb.py         # TMDB metadata ingestion
│   ├── ingest_georgian.py     # Regional catalog dataset parser
│   ├── notify.py              # Telegram and email dispatch engine
│   ├── mailer.py              # SMTP email templating
│   └── schema.py              # Database DDL and vector index schemas
├── data/
│   ├── georgian_movies_final.csv
│   └── tmdb_5000_movies.csv
├── frontend-next/
│   ├── public/                # Static assets and icons
│   └── src/
│       ├── app/
│       │   ├── movies/        # Movie catalog route
│       │   ├── watchlist/     # User watchlist route
│       │   ├── admin/         # Admin dashboard route
│       │   └── layout.jsx     # Global layout and theme wrapper
│       └── components/        # MovieCard, MovieModal, AuthModal, ...
├── main.py                    # FastAPI entry point and API routes
├── requirements.txt           # Production Python dependencies
└── run.bat                    # Local dev startup utility
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **PostgreSQL** with the `pgvector` extension enabled (a free [Neon](https://neon.tech/) project works well)
- A **TMDB API key** ([get one here](https://www.themoviedb.org/settings/api))

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/MovieSearch.git
cd MovieSearch
```

### 2. Configure environment variables

Create a `.env` file in the project root. Adjust the names to match your code.

```env
# Database
DATABASE_URL=postgresql://user:password@host/dbname

# External APIs
TMDB_API_KEY=your_tmdb_api_key

# Auth
JWT_SECRET=your_long_random_secret

# Notifications (optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
SMTP_HOST=smtp.example.com
SMTP_USER=you@example.com
SMTP_PASSWORD=your_smtp_password
```

### 3. Set up the backend

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create the schema and load the data:

```bash
python backend/schema.py
python backend/ingest_tmdb.py
python backend/ingest_georgian.py
```

Start the API:

```bash
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`, with interactive docs at `http://localhost:8000/docs`.

### 4. Set up the frontend

```bash
cd frontend-next
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

> 💡 **Windows shortcut:** run `run.bat` from the project root to start the local dev environment in one step.

---

## 🗺️ Roadmap

- [ ] Reranking for hybrid search results
- [ ] Personalized recommendations based on watchlists
- [ ] More regional catalogs
- [ ] Multilingual semantic search

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push and open a Pull Request

---

## 🙏 Acknowledgements

- [TMDB](https://www.themoviedb.org/) for movie metadata. *This product uses the TMDB API but is not endorsed or certified by TMDB.*
- [pgvector](https://github.com/pgvector/pgvector) and [Neon](https://neon.tech/) for serverless vector search
- [Hugging Face](https://huggingface.co/) and [ONNX Runtime](https://onnxruntime.ai/) for fast embedding inference

---

<div align="center">

**If you find this project useful, consider giving it a ⭐**

[Live Demo](https://movie-search-omega-opal.vercel.app/)

</div>
