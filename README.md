# ForgeQuote — Precision Costing & RFQ Lifecycle System

> **Industrial Forging & Machining RFQ-to-Quotation Management Platform**  
> *Built with Django 5.0 REST Framework, React 18, TypeScript, Tailwind CSS, PostgreSQL, PyMuPDF, and ReportLab.*

---

## 1. Executive Summary & Problem Statement

In industrial manufacturing—specifically closed-die forging, precision machining, and automotive component fabrication—estimators face critical operational bottlenecks:

1. **Slow Quotation Turnaround**: Generating quotes from 50-page engineering tender drawings, customer RFQ PDFs, and supplier Excel part lists takes 3 to 7 days manually.
2. **Spreadsheet Calculation Risks**: Excel costing sheets suffer from formula drift, broken cell references, inconsistent scrap allowances, and silent rounding errors.
3. **Margin Erosion & Commodity Volatility**: Raw steel bar prices (EN8, 20MnCr5, 40Cr4) fluctuate monthly. Updating base rates without historical versioning distorts past contractual commitments.
4. **Confidentiality Leaks**: Traditional quoting tools risk exposing internal steel purchase rates, machine hourly burdens, cycle times, and confidential margin percentages to external customers.
5. **Lack of Governance on High-Value Deals**: Multi-crore quotations often bypass executive review, leading to commercial exposure on large-volume contracts.

**ForgeQuote** solves these challenges through an integrated, audit-compliant manufacturing SaaS platform with:
* **Deterministic Costing Engine**: Exact Python `Decimal` formulas with multi-tier volume economics ($1\times, 0.5\times, 2\times$).
* **Date-Effective Rate Masters**: Versioned material and machine hourly rates with immutable costing snapshots.
* **AI-Assisted Document Intake**: Advisory text extraction from tender PDFs and Excel schedules with source citations and confidence metrics.
* **Historical Quote Search**: 4-factor geometry similarity engine to accelerate repeat bidding.
* **Statutory Approval Governance**: Backend-enforced ₹25,00,000 threshold requiring Sales Head approval before customer dispatch.
* **Customer PDF Generation**: Clean ReportLab executive proposals with **strictly zero leakage** of internal costs.

---

## 2. Platform Architecture & Technology Stack

```
[ Frontend: React 18 + Vite + TypeScript + Tailwind CSS ]
                       │
             JSON REST APIs (SimpleJWT Bearer)
                       ▼
[ Backend: Django 5.0.6 + Django REST Framework + Python 3.12 ]
   ├── apps.accounts      ── User authentication & RBAC (Estimator / Sales Head)
   ├── apps.rfqs          ── RFQ register, part technical specs, lifecycle tracking
   ├── apps.rate_masters  ── Versioned material rates & machine work-center rates
   ├── apps.costing       ── Deterministic Decimal costing engine & volume tiers
   ├── apps.quotations    ── Commercial proposals & ReportLab PDF generator
   ├── apps.approvals     ── Sales Head approval workflow (₹25L rule) & audit trail
   ├── apps.ai_intake     ── PyMuPDF & Pandas document parsing & advisory extractor
   └── apps.history       ── Geometric similarity scoring & quote comparison
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
[ PostgreSQL / SQLite ]      [ Private Media Vault ]
  (Relational Database)       (Drawings, PDFs & Excels)
```

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, Vite 5, TypeScript 5.4 | High-performance SPA with enterprise light theme |
| **Styling** | Tailwind CSS 3.4, Lucide Icons | Clean white card architecture, navy primary (`#172B4D`), radiant green accents (`#00EA64`) |
| **Backend API** | Django 5.0.6, Django REST Framework 3.15 | Secure, modular RESTful APIs |
| **Authentication** | Django SimpleJWT 5.3 | Stateles JWT access tokens (8h validity) with role claims |
| **Database** | PostgreSQL 14+ (SQLite for tests/dev) | ACID-compliant relational storage with Decimal fields |
| **PDF Extraction** | PyMuPDF (fitz) $\ge$ 1.24.12 | Fast text and title block extraction preserving page numbers |
| **Excel Parsing** | Pandas 2.2.2, OpenPyXL 3.1.4 | Multi-column part schedule extraction and preview |
| **PDF Generation** | ReportLab 4.2.0 | High-resolution customer quotation PDFs with authorized digital stamp |

---

## 3. End-to-End User Journey (The 12-Step Lifecycle)

```
[1. User Login]
       │
[2. Create RFQ] ──────> [3. Upload Drawings / Excel / Email]
                                   │
                         [4. AI Technical Extraction]
                                   │
                         [5. Review & Verify Fields]
                                   │
                         [6. Launch Costing Workspace]
                                   │
                         [7. Deterministic Costing Engine]
                                   │
                         [8. Volume Price Comparison (3 Tiers)]
                                   │
                         [9. Generate & Submit Quotation Draft]
                                   │
                         [10. Sales Head Approval / Revision]
                                   │
                   ┌───────────────┴───────────────┐
                   ▼                               ▼
      [Total Value > ₹25 Lakh]          [Total Value ≤ ₹25 Lakh]
      (Mandatory Sales Head Sign-off)   (Commercial Sign-off)
                   └───────────────┬───────────────┘
                                   │
                         [11. Download Customer PDF]
                                   │
                         [12. Dispatched & Saved to History]
```

---

## 4. Key Functional Modules

### A. Role-Based Access Control (RBAC)
* **Costing Estimator**: Can register RFQs, upload engineering drawings, review AI extractions, calculate costing sheets, draft quotations, and resubmit revisions. Cannot approve quotations.
* **Sales Head**: Can review high-value quotes, inspect confidential internal cost breakdowns, approve or reject quotations (mandatory reason required), request revisions, and authorize official dispatch.

### B. Versioned Rate Masters & Snapshots
* Material prices and machine hourly rates have date-effective spans (`effective_from` $\to$ `effective_until`).
* When costing is calculated, rates are captured into immutable snapshots (`material_grade_snapshot`, `material_rate_per_kg_snapshot`, `machine_hourly_rate_snapshot`). Subsequent updates to rate masters **never alter existing quotations or historical records**.

### C. Deterministic Costing Engine Formulas
All financial arithmetic is executed using Python's `Decimal` type to prevent binary floating-point drift:
* **Raw Material Cost**: $\text{Gross Weight (kg)} \times \text{Material Rate (₹/kg)} \times \left(1 - \text{Scrap \%} \times 0.20\right)$
* **Total Processing Cost**: $\sum_{i=1}^{n} \left(\frac{\text{Cycle Time (mins)}}{60} \times \text{Machine Hourly Rate (₹/hr)}\right)$
* **Manufacturing Subtotal**: $\text{Material Cost} + \text{Processing Cost} + \text{Direct Labour} + \text{Factory Overhead}$
* **Commercial Price per Unit**: $(\text{Manufacturing Subtotal} + \text{Freight}) \times \left(1 + \frac{\text{Margin \%}}{100}\right)$
* **Statutory GST**: $18.0\%$ computed separately.
* **Volume Tiers**: Automatically calculated at Baseline ($1\times$), Low Volume ($0.5\times$, +20% setup), and High Volume ($2\times$, -5% efficiency).

### D. Approval Workflow & ₹25 Lakh Threshold Rule
* Any quotation with total annual value $> ₹25,00,000$ strictly triggers the statutory governance requirement.
* Unapproved high-value quotes are blocked by backend model validation (`Quotation.clean()`) and cannot be dispatched to customers.
* Rejections and revision requests require mandatory detailed justifications which are preserved in an immutable chronological audit trail.

### E. Customer Quotation PDF Generation
* Generates official proposals including company letterhead, buyer contact/address, quotation reference, 30-day validity, component specs, tiered quantity pricing table, itemized GST, commercial terms, and digital authorized signature block.
* **Zero Cost Leakage Guarantee**: Internal steel purchase rates, machine hourly rates, cycle times, internal margins, and estimator notes are **strictly excluded** from the customer proposal.

---

## 5. Local Setup & Installation (Ubuntu / Linux)

### Prerequisites
* Python 3.12 or 3.13
* Node.js 18 or 20+ and npm
* Git

### Step 1: Clone Repository
```bash
git clone https://github.com/your-username/forgequote.git
cd forgequote
```

### Step 2: Configure Environment
```bash
# Copy root environment example
cp .env.example .env

# Copy backend environment example
cp backend/.env.example backend/.env

# Copy frontend environment example
cp frontend/.env.example frontend/.env
```

### Step 3: Backend Setup
```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
USE_SQLITE_FOR_TESTS=True python manage.py migrate

# Seed complete realistic demo data across all modules
USE_SQLITE_FOR_TESTS=True python manage.py seed_all_demo_data

# Start backend server on port 8000
USE_SQLITE_FOR_TESTS=True python manage.py runserver 0.0.0.0:8000
```

### Step 4: Frontend Setup
In a new terminal window:
```bash
cd frontend

# Install npm dependencies
npm install

# Start development server on port 5173
npm run dev -- --host 0.0.0.0 --port 5173
```

The application is now live at **http://localhost:5173/**!

---

## 6. Pre-Seeded Demo Credentials

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Costing Estimator** | `estimator@forgequote.in` | `Estimator@123` | RFQs, AI Intake, Costing, Quote Drafting |
| **Sales Head** | `saleshead@forgequote.in` | `SalesHead@123` | Quotation Approval, Reject/Revision, Send PDF |
| **Plant Head** | `planthead@forgequote.in` | `PlantHead@123` | General Management & Operations Review |

*(Quick-fill buttons are provided on the login page for one-click authentication).*

---

## 7. Running Automated Tests

### Backend Pytest Suite
```bash
cd backend
USE_SQLITE_FOR_TESTS=True .venv/bin/pytest tests/
```
**Outcome**:
```text
tests/test_auth_and_rfqs.py ......                                       [ 15%]
tests/test_phase2_rates_and_costing.py ...........                       [ 42%]
tests/test_phase3_ai_intake_and_history.py ...........                   [ 70%]
tests/test_phase4_approvals_and_pdf.py ............                      [100%]

================== 40 passed, 2 warnings in 82.17s ===================
```

### Frontend Typecheck & Build
```bash
cd frontend
npm test
# Equivalent to: tsc --noEmit && vite build
```
**Outcome**:
```text
✓ 1559 modules transformed.
dist/index.html                   0.75 kB │ gzip:   0.45 kB
dist/assets/index-Dp5j_mEc.css   31.84 kB │ gzip:   6.08 kB
dist/assets/index-CYELJ_dP.js   413.56 kB │ gzip: 109.51 kB
✓ built in 11.37s
```

---

## 8. Application Screenshots

| Screen | Description |
| :--- | :--- |
| **Operations Dashboard** | KPI metric cards (Active RFQs, Awaiting Estimation, Approvals, Won/Lost) and prioritized deadline queue. |
| **AI RFQ Intake** | 4-step wizard: Upload, Extract (PyMuPDF / Pandas), Review with source citations, Commit to RFQ. |
| **Costing Workspace** | Flagship 3-panel layout: Part specs, material & operations routing, deterministic Decimal unit economics & 3 volume tiers. |
| **Rate Masters** | Date-effective steel grade rates and machine work-center rates with date overlap validation. |
| **Commercial Approvals** | Sales Head cockpit with ₹25L threshold flags, low-margin warnings, review drawer, and approval action controls. |
| **Historical Archive** | Geometric similarity scoring (4-factor matching) and side-by-side variance analysis. |
| **System Settings** | Live API health probe, database status, statutory governance parameters, and RBAC matrix. |

---

## 9. License & Author

Developed by **ForgeQuote Engineering Team** as part of the 7-day Advanced Software Engineering Assessment.  
Licensed under the **MIT License**.

