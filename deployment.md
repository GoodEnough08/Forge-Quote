# ForgeQuote Deployment & Operations Guide

**GitHub Repository**: https://github.com/GoodEnough08/Forge-Quote  
**Release**: Version 1.0.0 (Phase 5 Final Release)  

This document provides complete instructions for local development, production configuration, Docker containerization, cloud deployment on Render (Backend) and Vercel (Frontend), and common troubleshooting steps.

---

## 1. System Requirements & Prerequisites

| Component | Minimum Version | Recommended | Notes |
| :--- | :--- | :--- | :--- |
| **Operating System** | Ubuntu 22.04 / Debian 12 / macOS | Linux x86_64 | Standard production host |
| **Python** | Python 3.12 | Python 3.12.3+ | Compatible with PyMuPDF prebuilt wheels |
| **Node.js** | Node 18.x LTS | Node 20.x LTS | For building Vite frontend bundle |
| **Database** | SQLite (Dev/Test) | PostgreSQL 14+ | Production ACID compliance |
| **Memory** | 1 GB RAM | 2 GB RAM | Required during ReportLab & PyMuPDF operations |
| **Disk Space** | 2 GB Free | 5 GB Free | For private media document storage |

---

## 2. Local Environment Setup (Ubuntu / Linux)

### Step 1: System Packages
```bash
sudo apt update && sudo apt install -y python3 python3-venv python3-pip nodejs npm git
```

### Step 2: Clone & Directory Navigation
```bash
git clone https://github.com/your-username/forgequote.git
cd forgequote
```

### Step 3: Backend Setup
```bash
cd backend

# 1. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 3. Environment configuration
cp ../backend/.env.example .env

# 4. Run database migrations
USE_SQLITE_FOR_TESTS=True python manage.py migrate

# 5. Populate complete demo data across all modules
USE_SQLITE_FOR_TESTS=True python manage.py seed_all_demo_data

# 6. Verify Django health
USE_SQLITE_FOR_TESTS=True python manage.py check

# 7. Start development server
USE_SQLITE_FOR_TESTS=True python manage.py runserver 0.0.0.0:8000
```

### Step 4: Frontend Setup
In a separate terminal:
```bash
cd frontend

# 1. Environment configuration
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Type check & build check
npm test

# 4. Start Vite development server
npm run dev -- --host 0.0.0.0 --port 5173
```

---

## 3. PostgreSQL Database Setup

### Option A: Local Native PostgreSQL
```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql -c "CREATE USER forgequote WITH PASSWORD 'forgequote_dev_pass';"
sudo -u postgres psql -c "CREATE DATABASE forgequote_db OWNER forgequote;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE forgequote_db TO forgequote;"

# Update backend/.env
POSTGRES_DB=forgequote_db
POSTGRES_USER=forgequote
POSTGRES_PASSWORD=forgequote_dev_pass
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
USE_SQLITE_FOR_TESTS=False

# Migrate and seed
python manage.py migrate
python manage.py seed_all_demo_data
```

### Option B: Docker Compose
From the repository root:
```bash
# Start PostgreSQL service in background
docker compose up -d db

# Verify container status
docker compose ps
```

---

## 4. Production Deployment

### A. Backend Deployment on Render (Web Service)

1. **Create Web Service**:
   * Connect your GitHub repository to Render.
   * Select **Web Service**.
   * Root Directory: `backend`
   * Environment: `Python`

2. **Build and Start Commands**:
   * **Build Command**:
     ```bash
     pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
     ```
   * **Start Command**:
     ```bash
     gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
     ```
     *(Note: If using gunicorn, ensure `gunicorn` is listed in your requirements).*

3. **Environment Variables**:
   | Variable | Value | Description |
   | :--- | :--- | :--- |
   | `DJANGO_SECRET_KEY` | `secure-random-64-character-string` | Production security key |
   | `DJANGO_DEBUG` | `False` | Disables debug mode in production |
   | `DJANGO_ALLOWED_HOSTS` | `.onrender.com` | Allowed incoming hosts |
   | `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname` | Managed PostgreSQL connection string |
   | `CORS_ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` | Allowed frontend origin |
   | `CORS_ALLOW_CREDENTIALS`| `True` | Allows Authorization headers |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | 8-hour access token window |
   | `USE_SQLITE_FOR_TESTS` | `False` | Forces PostgreSQL backend |

4. **Health Check Path**:
   * Set health probe to `/health` or `/api/v1/health`.

---

### B. Frontend Deployment on Vercel

1. **Import Project**:
   * Connect GitHub repository to Vercel.
   * Root Directory: `frontend`
   * Framework Preset: `Vite`

2. **Build and Output Settings**:
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
   * **Install Command**: `npm install`

3. **Environment Variables**:
   | Variable | Value | Notes |
   | :--- | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://your-forgequote-api.onrender.com/api/v1` | Must include `/api/v1` prefix and HTTPS |

4. **SPA Client-Side Routing**:
   * Ensure `frontend/vercel.json` exists for clean SPA routing:
     ```json
     {
       "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
     }
     ```

---

## 5. Automated Testing Verification

### Running Complete Test Suite
```bash
# Backend pytest suite (40 tests across all 5 phases)
cd backend
USE_SQLITE_FOR_TESTS=True .venv/bin/pytest tests/

# Frontend type check & production build check
cd ../frontend
npm test
```

---

## 6. Common Errors & Fixes

### 1. PyMuPDF compilation error on Python 3.13
* **Cause**: Older PyMuPDF versions (`<= 1.24.5`) attempt to compile MuPDF from C source if no prebuilt Linux wheel exists.
* **Fix**: Use `pymupdf>=1.24.12` in `requirements.txt` which provides official prebuilt Linux wheels for Python 3.12 and 3.13.

### 2. ReportLab Indian Rupee (₹) glyph rendering
* **Cause**: Standard Type 1 fonts (Helvetica, Times) in ReportLab do not contain the unicode glyph `\u20b9` and render it as `I` or `?`.
* **Fix**: In `pdf_generator.py`, monetary amounts are explicitly formatted as `INR 1,234.00`.

### 3. Unapproved Quotation Sending Prohibited
* **Cause**: Calling `/api/v1/quotations/<id>/send` on a quotation exceeding ₹25,00,000 without an `Approved` record raises `ValidationError`.
* **Fix**: This is an intentional statutory governance constraint. A user with the `SALES_HEAD` role must first approve the quotation via `/api/v1/approvals/<id>/approve`.

### 4. CORS Missing Header Error on Frontend
* **Cause**: Backend does not allow the frontend origin.
* **Fix**: Add the frontend domain (including protocol and port, with no trailing slash) to `CORS_ALLOWED_ORIGINS` in `backend/.env`.

