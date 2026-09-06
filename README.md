# RoadResQ Backend API
> Mobile Vehicle Repair & Roadside Assistance REST API powering real-time dispatch, inventory management, digital invoicing, SSLCommerz payments, and customer feedback.

---

## Table of Contents
1. [About the Project](#about-the-project)
2. [Project Overview](#project-overview)
3. [Key Features](#key-features)
4. [Tech Stack](#tech-stack)
5. [Dependencies](#dependencies)
6. [Installation & Setup](#installation--setup)
7. [Folder Structure](#folder-structure)
8. [API Documentation](#api-documentation)
9. [Live Deployment](#live-deployment)
10. [Demo Credentials](#demo-credentials)
11. [Contact](#contact)

---

## About the Project
When a driver's vehicle breaks down unexpectedly on the road, getting timely and reliable roadside assistance is critical. **RoadResQ** is an end-to-end backend system built to solve this exact real-world problem. 

The API powers the complete emergency assistance workflow: from a customer submitting a breakdown request with precise geographical coordinates, searching for nearby available mechanics using geospatial calculation (Haversine formula), transaction-safely assigning and dispatching a mechanic, tracking real-time status transitions and parts consumed from mechanic-specific inventory, generating digital invoices, processing SSLCommerz payment transactions, to collecting customer ratings and reviews.

---

## Project Overview
RoadResQ is a robust, production-ready, backend-only REST API (built without a frontend, thoroughly tested via Postman).

### Core Lifecycle Workflow
1. **Vehicle Breakdown**: A customer registers their vehicle and files an emergency roadside assistance request with coordinates (`lat`, `lng`) and priority level.
2. **Nearby Mechanic Search**: The system calculates distance using the Haversine formula and returns nearby available mechanics.
3. **Dispatch & Assignment**: The customer assigns a mechanic. The system enforces strict database transactions to guarantee a mechanic cannot be double-booked.
4. **Service Status Machine**: The assigned mechanic accepts the job and advances through legal status state machine transitions: `ASSIGNED` ➔ `EN_ROUTE` ➔ `ARRIVED` ➔ `IN_PROGRESS` ➔ `COMPLETED`.
5. **Inventory & Parts Usage**: The mechanic records spare parts used from their own per-mechanic inventory, deducting stock and snapshotting current item prices (`priceAtUse`).
6. **Invoicing**: Upon job completion, an automated invoice is generated incorporating labor costs and spare parts costs.
7. **SSLCommerz Payment Integration**: The customer initiates payment, generating a hosted gateway session URL via SSLCommerz (sandbox) with server-to-server callback reconciliation (`success`, `fail`, `cancel`).
8. **Customer Review**: The customer leaves a rating (1-5) and review for the completed service, which dynamically recalculates and aggregates the mechanic's overall rating on their profile.
9. **Admin Supervision**: Admins manage user roles, audit logs, global catalog items, and view real-time system KPIs & analytics.

---

## Key Features

- 🔐 **JWT Authentication & Token Rotation**: Secure register/login flows with short-lived Access Tokens (`15m`) and long-lived Refresh Tokens (`7d`) stored securely using SHA-256 hashes in the database with rotation on refresh and logout revocation.
- 🛡️ **Role-Based Access Control (RBAC)**: Fine-grained authorization middleware supporting three distinct user roles: `CUSTOMER`, `MECHANIC`, and `ADMIN`.
- 🚘 **Vehicle Management**: Full CRUD operations for customer vehicles (`make`, `model`, `plateNumber`) with soft delete filtering (`deletedAt`).
- 📍 **Mechanic Live Location & Availability**: Mechanics can dynamically update their real-time coordinates and availability states (`AVAILABLE`, `BUSY`, `OFFLINE`).
- 🌐 **Haversine Nearby Mechanic Search**: Geospatial distance calculations return available mechanics sorted by proximity to the breakdown location.
- ⚡ **Transaction-Safe Mechanic Assignment**: Uses Prisma database transactions (`$transaction`) to verify mechanic availability and lock states simultaneously, preventing race conditions or double-booking.
- 🔄 **Status Machine Lifecycle**: Enforces rigid state machine transitions (`PENDING` ➔ `SEARCHING` ➔ `ASSIGNED` ➔ `EN_ROUTE` ➔ `ARRIVED` ➔ `IN_PROGRESS` ➔ `COMPLETED` / `CANCELLED`).
- 🛠️ **Per-Mechanic Spare Parts Inventory**: Decoupled catalog model allowing mechanics to manage their own custom/catalog stock quantities and item prices (`MechanicInventory`).
- 📄 **Automated Digital Invoicing**: Generates detailed service request invoices snapshotting labor cost, parts cost, and total amount.
- 💳 **SSLCommerz Payment Gateway Integration**: Real integration with SSLCommerz sandbox API for online payments, featuring payment initiation and IPN/callback handlers (`success`, `fail`, `cancel`).
- ⭐ **Customer Reviews & Rating Aggregation**: Post-service customer feedback system that automatically recalculates and updates the mechanic's overall rating average on their profile.
- 📊 **Admin Dashboard & Audit Logging**: Admin statistics endpoint returning platform KPIs (total revenue, completed jobs, active mechanics) and system-wide audit trail logs.
- 🗑️ **Soft Deletion & Clean Filtering**: Soft delete support across User, Vehicle, and SparePart resources ensuring historical record retention.
- 📑 **Pagination, Search & Filtering**: Standardized query pagination (`page`, `limit`) and case-insensitive search (`?search=`) across list endpoints.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime** | Node.js (v24.x) |
| **Language** | TypeScript (v5.6.3) |
| **Framework** | Express.js (v4.21.1) |
| **Database** | PostgreSQL (Hosted on Neon Database) |
| **ORM** | Prisma ORM (v5.22.0) |
| **Data Validation** | Zod (v4.5.4) |
| **Authentication** | JSON Web Tokens (`jsonwebtoken` v9.0.3) & bcrypt (`bcrypt` v6.0.0) |
| **Payment Gateway** | SSLCommerz Sandbox API |
| **Security & Utilities** | Helmet, CORS, Dotenv |
| **Deployment Platform** | Vercel Serverless Functions |

---

## Dependencies

### Core Production Dependencies
*(From `package.json`)*

```json
"dependencies": {
  "@prisma/client": "^5.22.0",
  "bcrypt": "^6.0.0",
  "cors": "^2.8.5",
  "dotenv": "^16.4.5",
  "express": "^4.21.1",
  "helmet": "^8.0.0",
  "jsonwebtoken": "^9.0.3",
  "zod": "^4.5.4"
}
```

### Development Dependencies
```json
"devDependencies": {
  "@types/bcrypt": "^6.0.0",
  "@types/cors": "^2.8.17",
  "@types/express": "^5.0.0",
  "@types/jsonwebtoken": "^9.0.10",
  "@types/node": "^22.9.0",
  "@typescript-eslint/eslint-plugin": "^8.14.0",
  "@typescript-eslint/parser": "^8.14.0",
  "eslint": "^9.15.0",
  "eslint-config-prettier": "^9.1.0",
  "prettier": "^3.3.3",
  "prisma": "^5.22.0",
  "tsx": "^4.19.2",
  "typescript": "^5.6.3"
}
```

---

## Installation & Setup

### 1. Clone Repository
```bash
git clone https://github.com/tasifhossan/RoadResQ-backend.git
cd RoadResQ-backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the project root based on `.env.example`:

```env
# Application
PORT=5000
NODE_ENV=development

# Database Connections (Neon PostgreSQL)
DATABASE_URL="postgresql://<user>:<password>@<neon-host-pooler>/roadresq?sslmode=require"
DIRECT_URL="postgresql://<user>:<password>@<neon-host-direct>/roadresq?sslmode=require"
SHADOW_DATABASE_URL="postgresql://<user>:<password>@<neon-host-direct>/roadresq?schema=prisma_shadow&sslmode=require"

# JWT Secrets & Expiry
JWT_ACCESS_SECRET="your-jwt-access-secret-key"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-jwt-refresh-secret-key"
JWT_REFRESH_EXPIRES_IN="7d"

# SSLCommerz Payment Gateway Configuration
SSLCOMMERZ_STORE_ID="your_sslcommerz_store_id"
SSLCOMMERZ_STORE_PASSWORD="your_sslcommerz_store_password"
SSLCOMMERZ_IS_LIVE="false"
SSLCOMMERZ_SUCCESS_URL="https://road-res-q-backend.vercel.app/api/v1/payments/success"
SSLCOMMERZ_FAIL_URL="https://road-res-q-backend.vercel.app/api/v1/payments/fail"
SSLCOMMERZ_CANCEL_URL="https://road-res-q-backend.vercel.app/api/v1/payments/cancel"
```

### 4. Run Prisma Database Migrations
```bash
npx prisma migrate deploy
```

### 5. Seed Initial Database Data
Execute the database seed script to generate initial users, vehicles, global spare parts catalog, and mechanic inventory:
```bash
npx prisma db seed
```

### 6. Start Development Server
```bash
npm run dev
```
The server will start at `http://localhost:5000`.

---

## Folder Structure

The project follows a clean modular architectural pattern where feature components are encapsulated inside dedicated module folders (`src/modules/<feature>`):

```text
src/
├── config/                  # Configuration setup (database connection & environment variables)
│   ├── db.ts
│   └── env.ts
├── errors/                  # Global custom application errors
│   └── AppError.ts
├── middlewares/             # Express middlewares
│   ├── auth.middleware.ts   # JWT verification middleware
│   ├── globalErrorHandler.ts # Centralized error handling
│   ├── notFoundHandler.ts   # 404 Route Not Found middleware
│   └── rbac.middleware.ts   # Role-Based Access Control middleware
├── modules/                 # Application Feature Modules
│   ├── admin/               # User management, stats & audit logs
│   ├── auth/                # Register, login, refresh token, logout
│   ├── invoices/            # Invoice details & calculation
│   ├── mechanic-inventory/  # Per-mechanic spare parts inventory CRUD & restocking
│   ├── mechanics/           # Availability, location updates & mechanic reviews
│   ├── payments/            # Payment initiation & SSLCommerz callback routes
│   ├── reviews/             # Customer feedback & rating aggregation
│   ├── service-requests/    # Dispatch, nearby mechanics, status state machine & parts used
│   ├── spare-parts/         # Global spare parts catalog management
│   ├── users/               # User profile management
│   └── vehicles/            # Customer vehicle registration & CRUD
├── types/                   # Express custom request type definitions
│   └── express.d.ts
├── utils/                   # Shared utility helpers
│   ├── formatZodError.ts    # Zod error formatting helper
│   ├── hashPassword.ts      # Bcrypt hashing & password comparison
│   ├── jwt.ts               # JWT sign & verify functions
│   └── sendResponse.ts      # Standardized JSON response envelope
├── app.ts                   # Express application middleware configuration & route mounting
└── server.ts                # Application entrypoint & HTTP listener
```

---

## API Documentation

The complete REST API postman collection is available at [`RoadResQ.postman_collection.json`](./RoadResQ.postman_collection.json).

### Endpoint Overview (Total 48 Registered Endpoints)

| Module | Base Path | Total Endpoints | Description |
| :--- | :--- | :---: | :--- |
| **System & Health** | `/api/v1/health` | 2 | API welcome root and system health check status. |
| **Authentication** | `/api/v1/auth` | 4 | User registration, login, refresh token rotation, and logout. |
| **Users** | `/api/v1/users` | 2 | Authenticated user profile retrieval and update (`/me`). |
| **Vehicles** | `/api/v1/vehicles` | 5 | Customer vehicle registration, listing, retrieval, update, and soft delete. |
| **Mechanics** | `/api/v1/mechanics` | 3 | Mechanic availability state updates, location tracking, and mechanic reviews list. |
| **Mechanic Inventory** | `/api/v1/mechanics/me/inventory` | 5 | Mechanic inventory management (add catalog part, view stock, edit price, restock, delete). |
| **Service Requests** | `/api/v1/service-requests` | 10 | Service request creation, nearby mechanic search, mechanic assignment, status transitions, parts usage, and request reviews. |
| **Spare Parts Catalog** | `/api/v1/spare-parts` | 5 | Global catalog viewing and admin catalog management (CRUD). |
| **Invoices** | `/api/v1/invoices` | 1 | Detailed invoice retrieval for completed service requests. |
| **Payments** | `/api/v1/payments` | 5 | SSLCommerz payment session initiation, payment status check, and callback endpoints (`success`, `fail`, `cancel`). |
| **Admin** | `/api/v1/admin` | 6 | Admin user management (role changes, deactivation, reactivation), dashboard KPIs, and audit log inspection. |

---

## Live Deployment

- 🌐 **Live API Base URL**: [https://road-res-q-backend.vercel.app](https://road-res-q-backend.vercel.app)
- 🏥 **Health Check Endpoint**: [https://road-res-q-backend.vercel.app/api/v1/health](https://road-res-q-backend.vercel.app/api/v1/health)

---

## Demo Credentials

The database is pre-populated via `npx prisma db seed` with test credentials across all user roles for immediate manual testing in Postman:

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **MECHANIC** | Alex Miller | `alex.mechanic@roadresq.com` | `password123` |
| **CUSTOMER** | Alex Johnson | `alex.johnson@example.com` | `password123` |

---

## Contact

- **Developer Name**: Tasif Hossan
- **Email**: [tasifhossan@gmail.com]
- **GitHub**: [https://github.com/tasifhossan](https://github.com/tasifhossan)
- **Live Deployment**: [https://road-res-q-backend.vercel.app](https://road-res-q-backend.vercel.app)
