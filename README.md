# 🎬 MovieSearch Pro

> A semantic & hybrid movie discovery platform that helps you find movies by keywords, directors, actors, and natural-language scene descriptions (e.g., *"a man enters people's dreams to steal secrets"*).

[![Live Demo](https://img.shields.io/badge/Demo-Live%20Site-blue?style=for-the-badge&logo=vercel)](https://movie-search-omega-opal.vercel.app/)
[![Frontend](https://img.shields.io/badge/Next.js-14%2B-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Backend](https://img.shields.io/badge/FastAPI-Python-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Neon-PostgreSQL%20%2B%20pgvector-00E599?style=for-the-badge&logo=postgresql)](https://neon.tech/)

---

## 🌟 Key Features

- **Semantic Scene Search:** Uses high-performance ONNX text embeddings and vector similarity (`pgvector`) to find movies even when you only remember a scene or premise.
- **Traditional Lexical Filters:** Instant search and filtering across movie titles, directors, actors, release years, and genres.
- **Localized & Enriched Datasets:** Integrated TMDB metadata coupled with specialized regional collections (including Georgian cinema archives).
- **Authentication & Watchlists:** Secure user authentication (JWT) with custom personal watchlist management.
- **Admin & Instant Notifications:** Automated Telegram bot notifications and email dispatch alerts upon user activity and registrations.
- **Responsive Modern UI:** Fast Next.js app with dark mode support, movie detail modals, responsive grid cards, and mobile-ready layouts.

---

## 🏗️ System Architecture

```text
               ┌────────────────────────────────────────┐
               │         Next.js Client (Vercel)        │
               │   - Semantic Search & Lexical Filters  │
               │   - User Watchlist & Modals            │
               └───────────────────┬────────────────────┘
                                   │ HTTP / JSON
                                   ▼
               ┌────────────────────────────────────────┐
               │        FastAPI Backend (Render)        │
               │   - Authentication (JWT / bcrypt)      │
               │   - Hybrid Search & Query Pipelines    │
               │   - Notifications (Telegram / SMTP)    │
               └─────────┬───────────────────┬──────────┘
                         │                   │
         Embedding (ONNX)│                   │ SQL & Vector KNN
                         ▼                   ▼
      ┌─────────────────────────┐   ┌─────────────────────────┐
      │ Hugging Face / Runtime  │   │     Neon PostgreSQL     │
      │   ONNX Text Embeddings  │   │  - Movies & Cast Data   │
      │   Vector Normalization  │   │  - Users & Watchlists   │
      │                         │   │  - pgvector Embeddings  │
      └─────────────────────────┘   └─────────────────────────┘

## 🛠️ Tech Stack

### Frontend
- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) / CSS Modules
- **Icons & Modals:** [Heroicons](https://heroicons.com/) / [Lucide Icons](https://lucide.dev/) & Custom SVG icons
- **Hosting:** [Vercel](https://vercel.com/)

### Backend
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
- **Embedding / ML:** [ONNX Runtime](https://onnxruntime.ai/) / [Hugging Face Transformers](https://huggingface.co/)
- **HTTP Client & Mailer:** Standard Library `urllib`, `smtplib`, and `email.mime`
- **Hosting:** [Render](https://render.com/)

### Database & Storage
- **Database:** Serverless [Neon PostgreSQL](https://neon.tech/)
- **Vector Search Extension:** [`pgvector`](https://github.com/pgvector/pgvector)
- **External Metadata:** [The Movie Database (TMDB) API](https://www.themoviedb.org/)




# 📁 Project Structure

MovieSearch/
├── backend/
│   ├── analyze_corpus.py       # Corpus and text analysis tools
│   ├── db_config.py           # Database connection & pooling configuration
│   ├── encoder.py             # ONNX embedding generator for scene search
│   ├── ingest_tmdb.py         # TMDB metadata ingestion scripts
│   ├── ingest_georgian.py     # Regional catalog dataset parser
│   ├── notify.py              # Telegram & email dispatch engine
│   ├── mailer.py              # SMTP email templater
│   └── schema.py              # Database DDL & vector index schemas
├── data/
│   ├── georgian_movies_final.csv
│   └── tmdb_5000_movies.csv
├── frontend-next/
│   ├── public/                # Static assets & icons
│   └── src/
│       ├── app/
│       │   ├── movies/        # Movie catalog route
│       │   ├── watchlist/     # User watchlist route
│       │   ├── admin/         # Admin dashboard route
│       │   └── layout.jsx     # Global layout and theme wrapper
│       └── components/        # MovieCard, MovieModal, AuthModal, etc.
├── main.py                    # FastAPI entry point & API routes
├── requirements.txt           # Production Python dependencies
└── run.bat                    # Local dev startup utility




# 🚀 Getting Started Locally
Prerequisites
Node.js 18+ & npm

Python 3.10+

A running PostgreSQL database (with pgvector enabled)

A TMDB API key
