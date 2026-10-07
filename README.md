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

## ⚙️ Environment Configuration

### 1. Backend (`.env` in project root)

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://<user>:<password>@<host>/<dbname>?sslmode=require

# JWT Authentication
SECRET_KEY=your_super_secret_jwt_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# External APIs
TMDB_API_KEY=your_tmdb_api_key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend URL
FRONTEND_URL=http://localhost:3000
