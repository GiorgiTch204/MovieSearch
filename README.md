# MovieSearch Pro 🎬

MovieSearch Pro is a full-stack movie discovery platform combining hybrid semantic vector search, dual catalog integration (Georgian Cinema Archives + International TMDb), JWT-based user authentication, and a Stripe payment gateway for Pro subscriptions.

---

## 🚀 Key Features

* **Dual Catalog Architecture**:
  * **TMDb (International)**: Automatic YouTube trailer embeds, cast lists, ratings, and high-res backdrops.
  * **Georgian Cinema Archive (Geocinema)**: Tailored archival UI highlighting Georgian titles, directors, studios, and historical production data with poster fallbacks.
* **Hybrid Semantic & Keyword Search**: Powered by PostgreSQL + `pgvector` with cosine similarity (`<=>`) over 384-dimensional Sentence-BERT embeddings combined with keyword matching.
* **Vector-Based Movie Recommendations**: Recommends semantically similar films across both catalogs on click.
* **Authentication & User Management**: Secure registration, login, and session persistence using JWT tokens, bcrypt password hashing, and local storage.
* **Stripe Pro Pass Payments**: Hosted Stripe Checkout flow with webhook verification to unlock unlimited searches and Pro features.

---

## 🛠 Tech Stack

* **Frontend**: Next.js 16 (App Router, Turbopack), Tailwind CSS, Lucide React
* **Backend**: FastAPI, Uvicorn, Pydantic, Python-JOSE, Passlib / Bcrypt
* **Database & Vector Store**: PostgreSQL with `pgvector` (hosted on Neon) via `psycopg2`
* **External APIs**: TMDb API (trailers, credits, artwork), Stripe API (checkout & webhooks)

---

## 📋 Prerequisites

* **Python**: 3.10+
* **Node.js**: 18.0+ and `npm`
* **PostgreSQL**: Neon or any PostgreSQL instance with `pgvector` support
* **API Keys**:
  * [TMDb API Key](https://www.themoviedb.org/documentation/api)
  * [Stripe Test API Keys](https://dashboard.stripe.com/test/apikeys)

---

## 📂 Datasets

The application relies on two CSV datasets containing film metadata and overviews:

1. **`tmdb_5000_movies.csv`**: Contains international films with metadata, plots, vote averages, and release dates.
2. **`geocinema_movies.csv`**: Contains classic and archival Georgian cinema metadata (titles in Georgian and English, directors, cast members, studios, and plot summaries).

Both datasets are available in the repository:
👉 [https://github.com/GiorgiTch204/csvs](https://github.com/GiorgiTch204/csvs)

Clone or download the CSV files into your project's `data/` directory:

```bash
mkdir data
# Download or place tmdb_5000_movies.csv and geocinema_movies.csv inside data/
