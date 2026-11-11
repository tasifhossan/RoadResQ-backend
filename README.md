# 🚗 RoadResQ Backend API

<div align="center">

  [![Live API](https://img.shields.io/badge/Live_API-Online-success?style=for-the-badge&logo=vercel&logoColor=white)](https://road-res-q-backend.vercel.app/api/v1/health)
  [![Frontend Repo](https://img.shields.io/badge/Frontend_Repo-RoadResQ-blue?style=for-the-badge&logo=github)](https://github.com/tasifhossan/RoadResQ)
  [![Node.js](https://img.shields.io/badge/Node.js-v22+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Express](https://img.shields.io/badge/Express-4.21-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_DB-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech/)
  [![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
  [![License](https://img.shields.io/badge/License-ISC-amber?style=for-the-badge)](./package.json)

  <p align="center">
    <strong>Production-grade RESTful API powering an on-demand emergency roadside assistance and mobile vehicle repair platform.</strong>
  </p>

  <p align="center">
    <a href="https://road-res-q-backend.vercel.app">Live Base URL</a> •
    <a href="https://road-res-q-backend.vercel.app/api/v1/health">API Health Check</a> •
    <a href="https://github.com/tasifhossan/RoadResQ">Frontend Repository</a> •
    <a href="#-api-documentation--endpoint-catalog">API Endpoints</a> •
    <a href="#-installation--local-setup">Local Setup</a>
  </p>
</div>

---

## 📋 Table of Contents

- [About the Backend](#-about-the-backend)
- [Key Features](#-key-features)
- [Backend Tech Stack](#-backend-tech-stack)
- [Architecture Overview](#-architecture-overview)
- [Database Schema & Entities](#-database-schema--entities)
- [Authentication, RBAC & Security](#-authentication-rbac--security)
- [API Documentation & Endpoint Catalog](#-api-documentation--endpoint-catalog)
- [Project Folder Structure](#-project-folder-structure)
- [Prerequisites](#-prerequisites)
- [Installation & Local Setup](#-installation--local-setup)
- [Environment Variables](#-environment-variables)
- [Database Setup & Seeding](#-database-setup--seeding)
- [Available Scripts](#-available-scripts)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [External Integrations](#-external-integrations)
- [Frontend Integration](#-frontend-integration)
- [Contributing](#-contributing)
- [License](#-license)
- [Contact](#-contact)

---

## 📖 About the Backend

When a driver's vehicle breaks down unexpectedly on the road, getting timely, transparent, and trustworthy roadside assistance is critical. **RoadResQ Backend** is a modular, production-ready REST API built with Node.js, Express, TypeScript, and Prisma ORM to solve this real-world emergency challenge.

The backend orchestrates the full operational lifecycle of on-demand roadside assistance:
- Ingesting emergency breakdown requests with precise geographical coordinates (`lat`, `lng`), priority levels, and damage images.
- Performing proximity discovery using the **Haversine formula** to locate available mobile mechanics within radius.
- Enforcing database transaction boundaries (`$transaction`) to safely lock and assign mechanics without double-booking race conditions.
- Driving service tickets through a rigid state machine (`PENDING` ➔ `SEARCHING` ➔ `ASSIGNED` ➔ `EN_ROUTE` ➔ `ARRIVED` ➔ `IN_PROGRESS` ➔ `COMPLETED`).
- Tracking spare parts consumed from per-mechanic inventory, snapshotting historical unit prices (`priceAtUse`).
- Generating itemized digital invoices and integrating with **SSLCommerz** hosted payment gateways.
- Aggregating verified customer reviews and updating mechanic reputation ratings.

---

## 🚀 Key Features

### 🔐 Authentication & Session Security
- **Dual-Token JWT Authentication**: Short-lived access tokens (`15m`) and long-lived refresh tokens (`7d`) stored securely using SHA-256 hashes in PostgreSQL with rotation and logout revocation.
- **Google OAuth 2.0 Verification**: Seamless Google Sign-In (`POST /api/v1/auth/google`) using `google-auth-library`. Verifies ID token signature and audience, auto-provisions `CUSTOMER` accounts, and rejects deactivated accounts.
- **Role-Based Access Control (RBAC)**: Declarative route authorization guards enforcing permissions across three distinct user roles: `CUSTOMER`, `MECHANIC`, and `ADMIN`.

### 📍 Dispatch & State Machine Engine
- **Geospatial Discovery (Haversine)**: Calculates geographic distances between customer breakdowns and active mechanics, returning nearest mechanics ordered by distance.
- **Atomic Concurrency Guards**: Uses Prisma interactive database transactions to lock mechanic availability and ticket status simultaneously, eliminating race conditions.
- **Strict Lifecycle State Machine**: Enforces valid ticket transitions (`PENDING` / `SEARCHING` / `ASSIGNED` ➔ `CANCELLED`, or `ASSIGNED` ➔ `EN_ROUTE` ➔ `ARRIVED` ➔ `IN_PROGRESS` ➔ `COMPLETED`).

### 🛠️ Inventory & Automated Invoicing
- **Two-Tier Spare Parts Architecture**: Global catalog of standard automotive parts combined with mechanic-specific custom inventory, quantity tracking, and custom unit pricing.
- **Dynamic Invoicing Engine**: Automatically aggregates hourly mechanic labor cost and parts used (captured at `priceAtUse`) into an itemized invoice.
- **Low-Stock Monitoring**: Dedicated query filter for mechanics to identify inventory items falling below safety thresholds (`LOW_STOCK_THRESHOLD = 5`).

### 💳 Payments & Feedback
- **SSLCommerz Payment Gateway**: Full sandbox payment lifecycle integration including session initiation, IPN validation, and redirect callbacks (`/success`, `/fail`, `/cancel`).
- **Rating & Review Aggregation**: Closed-loop post-service review system that recalculates the mechanic's composite rating average upon every review submission.
- **Admin Supervision & Audit Trails**: Real-time operational KPI dashboards (monthly revenue, completed jobs, active mechanics) and immutable system audit log tracking.

---

## 🛠️ Backend Tech Stack

<div align="center">
  <img src="https://skillicons.dev/icons?i=nodejs,typescript,express,postgres,prisma,gcp&theme=light" alt="Backend Tech Icons" />
</div>

<br/>

| Component | Technology | Version | Description |
| :--- | :--- | :--- | :--- |
| **Runtime** | [Node.js](https://nodejs.org/) | `>=20.x` (v22/v24 recommended) | High-performance JavaScript runtime |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `^5.6.3` | Type-safe static analysis and developer tooling |
| **Web Framework** | [Express.js](https://expressjs.com/) | `^4.21.1` | Minimalist and flexible Node.js web framework |
| **Database** | [PostgreSQL](https://www.postgresql.org/) | `15+` (Hosted on [Neon](https://neon.tech/)) | Serverless cloud PostgreSQL with connection pooling |
| **ORM** | [Prisma](https://www.prisma.io/) | `^5.22.0` | Next-generation type-safe Node.js & TypeScript ORM |
| **Schema Validation** | [Zod](https://zod.dev/) | `^4.5.4` | TypeScript-first schema declaration and runtime validation |
| **Authentication** | [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) & [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | `^9.0.3` / `^6.0.0` | JWT token generation/verification & salted password hashing |
| **OAuth Verification** | [google-auth-library](https://github.com/googleapis/google-auth-library-nodejs) | `^11.3.1` | Google OAuth 2.0 ID token signature & audience validation |
| **Media Storage** | [Cloudinary](https://cloudinary.com/) & [Multer](https://github.com/expressjs/multer) | `^1.41.3` / `^2.3.0` | Multipart image upload for breakdown scene photos |
| **Payment Gateway** | [SSLCommerz Sandbox API](https://sslcommerz.com/) | REST API | Payment session creation and callback verification |
| **Security Utilities** | [Helmet](https://helmetjs.github.io/), [CORS](https://github.com/expressjs/cors), [express-rate-limit](https://express-rate-limit.mintlify.app/) | `^8.0.0` / `^2.8.5` / `^8.7.0` | HTTP headers hardening, origin whitelist, and rate limiting |

---

## 🏗️ Architecture Overview

The backend is built around a **Modular Layered Architecture** (`modules/<feature>/`), isolating feature concerns while sharing common infrastructure (database connection, error handling, middlewares, and utilities):

```
Client (Web / Mobile App)
   │  HTTPS Requests with JSON Payload & Bearer Token
   ▼
Express Application Gateway (app.ts)
   │  ├── Helmet (Security Headers)
   │  ├── CORS (Origin Allowlist)
   │  ├── Rate Limiting (generalLimiter / publicLimiter)
   │  └── Body Parsers (express.json, express.urlencoded)
   ▼
Feature Routing Layer (*.route.ts)
   │  ├── Authentication Middleware (auth.middleware.ts: JWT validation & user attachment)
   │  └── Role-Based Access Control (rbac.middleware.ts: CUSTOMER | MECHANIC | ADMIN)
   ▼
Controller Layer (*.controller.ts)
   │  ├── Input Validation (Zod Schemas & formatZodError.ts)
   │  └── Request/Response Orchestration (catchAsync wrappers)
   ▼
Service Layer / Business Logic (*.service.ts)
   │  ├── Domain Rules & Invariants
   │  ├── Geospatial Proximity Calculation (Haversine formula)
   │  └── Atomic Multi-Table Operations ($transaction)
   ▼
Data Access Layer (Prisma Client)
   │  Type-Safe Queries, Relationship Includes & Soft Delete Filters
   ▼
PostgreSQL Database (Neon DB)
   │
   ▼ (Errors bubbled up via next(err))
Global Error Handler (globalErrorHandler.ts)
   │  Translates ZodError, Prisma Known Errors (P2002), and AppError
   ▼
Standardized Response Envelope (sendResponse.ts)
```

### Request & Dispatch Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (Client)
    participant Gateway as Express Gateway
    participant Auth as Auth & RBAC Guard
    participant Controller as Service Request Controller
    participant Service as Service Request Logic
    participant DB as PostgreSQL (Prisma ORM)

    Customer->>Gateway: POST /api/v1/service-requests (Bearer Token + Coordinates)
    Gateway->>Auth: Verify JWT & CUSTOMER role
    Auth->>Controller: Forward authenticated request
    Controller->>Service: createServiceRequest(customerId, payload)
    Note over Service: Validate vehicle ownership & payload constraints
    Service->>DB: prisma.serviceRequest.create(...)
    DB-->>Service: Return created ServiceRequest
    Service-->>Controller: Return ticket entity
    Controller-->>Customer: HTTP 201 Created { success: true, data: { id, status: "PENDING" } }
```

---

## 🗄️ Database Schema & Entities

The relational database runs on **PostgreSQL** hosted via **Neon DB**, utilizing Prisma ORM with connection pooling (`DATABASE_URL`) and direct migrations (`DIRECT_URL`).

```mermaid
erDiagram
    User ||--o| MechanicProfile : "1:1 profile"
    User ||--o{ Vehicle : "1:N owns"
    User ||--o{ ServiceRequest : "1:N customer"
    User ||--o{ ServiceRequest : "1:N mechanic"
    User ||--o{ Review : "1:N writes"
    User ||--o{ RefreshToken : "1:N sessions"
    User ||--o{ AuditLog : "1:N actor"
    User ||--o{ SparePart : "1:N created"

    MechanicProfile ||--o{ MechanicInventory : "1:N stocks"
    MechanicProfile ||--o{ LocationUpdate : "1:N telemetry"

    Vehicle ||--o{ ServiceRequest : "1:N assigned to"

    ServiceRequest ||--o{ ServiceRequestImage : "1:N photos"
    ServiceRequest ||--o{ ServiceRequestPart : "1:N consumes"
    ServiceRequest ||--o| Invoice : "1:1 generates"
    ServiceRequest ||--o| Review : "1:1 feedback"

    SparePart ||--o{ MechanicInventory : "1:N catalog item"
    SparePart ||--o{ ServiceRequestPart : "1:N parts used"

    Invoice ||--o| Payment : "1:1 billing"
```

### Core Entities Summary

| Entity | Primary Key | Key Attributes | Relationships |
| :--- | :--- | :--- | :--- |
| **`User`** | `id` (cuid) | `name`, `email`, `password`, `role`, `phone`, `deletedAt` | 1:1 `MechanicProfile`, 1:N `Vehicle`, 1:N `ServiceRequest` |
| **`MechanicProfile`**| `id` (cuid) | `userId` (FK), `skills`, `city`, `currentLat`, `currentLng`, `availability`, `rating`, `totalJobs` | 1:1 with `User`, 1:N `MechanicInventory`, 1:N `LocationUpdate` |
| **`Vehicle`** | `id` (cuid) | `customerId` (FK), `make`, `model`, `plateNumber`, `deletedAt` | N:1 with `User`, 1:N `ServiceRequest` |
| **`ServiceRequest`** | `id` (cuid) | `customerId` (FK), `mechanicId` (FK), `vehicleId` (FK), `description`, `lat`, `lng`, `status`, `priority` | N:1 with `User`, 1:1 `Invoice`, 1:1 `Review`, 1:N `ServiceRequestPart` |
| **`ServiceRequestImage`** | `id` (cuid) | `serviceRequestId` (FK), `url`, `publicId`, `uploadedAt` | N:1 with `ServiceRequest` (Cloudinary metadata) |
| **`SparePart`** | `id` (cuid) | `name`, `isGlobal`, `createdByMechanicId` (FK), `deletedAt` | 1:N `MechanicInventory`, 1:N `ServiceRequestPart` |
| **`MechanicInventory`** | `id` (cuid) | `mechanicProfileId` (FK), `sparePartId` (FK), `price`, `stock` | N:1 `MechanicProfile`, N:1 `SparePart` (Unique pair) |
| **`ServiceRequestPart`** | `id` (cuid) | `serviceRequestId` (FK), `sparePartId` (FK), `quantity`, `priceAtUse` | N:1 `ServiceRequest`, N:1 `SparePart` |
| **`Invoice`** | `id` (cuid) | `serviceRequestId` (FK, unique), `laborCost`, `partsCost`, `totalAmount`, `status` | 1:1 with `ServiceRequest`, 1:1 with `Payment` |
| **`Payment`** | `id` (cuid) | `invoiceId` (FK, unique), `gateway`, `transactionId`, `amount`, `status`, `paidAt` | 1:1 with `Invoice` |
| **`Review`** | `id` (cuid) | `serviceRequestId` (FK, unique), `customerId` (FK), `rating`, `comment` | 1:1 with `ServiceRequest`, N:1 with `User` |
| **`RefreshToken`** | `id` (cuid) | `userId` (FK), `token` (unique hash), `expiresAt` | N:1 with `User` |
| **`AuditLog`** | `id` (cuid) | `actorId` (FK), `action`, `entityType`, `entityId`, `metadata` | N:1 with `User` |

---

## 🔒 Authentication, RBAC & Security

### Security Layers
1. **Password Hashing**: Salted hashes generated via `bcrypt` with work factor 10.
2. **Access Token Verification**: Extracted from `Authorization: Bearer <token>` and verified against `JWT_ACCESS_SECRET`.
3. **Refresh Token Rotation**: Upon calling `POST /api/v1/auth/refresh-token`, the old token hash is revoked and replaced with a new token pair inside an atomic transaction.
4. **Role-Based Guards (`rbac.middleware.ts`)**:
   - `CUSTOMER`: Can register vehicles, post requests, cancel tickets, and leave reviews.
   - `MECHANIC`: Can broadcast coordinates, accept assignments, update statuses, manage inventory, and log parts.
   - `ADMIN`: Full oversight over users, roles, platform metrics, and audit logs.
5. **Rate Limiting**:
   - Authentication routes: Strict limits (`registerLimiter`, `loginLimiter`).
   - Public directory: `publicLimiter` for public browsing.
   - General API: `generalLimiter` across standard endpoints.

---

## 📡 API Documentation & Endpoint Catalog

Base API Route: `/api/v1`

### 1. System & Health
| Method | Endpoint | Description | Auth | Role |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/` | API welcome greeting and root status | None | Public |
| `GET` | `/api/v1/health` | Uptime and operational health status | None | Public |

### 2. Authentication (`/api/v1/auth`)
| Method | Endpoint | Description | Auth | Role |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | `/api/v1/auth/register` | Register new user account with role | None | Public |
| `POST` | `/api/v1/auth/login` | Authenticate with email/password; returns token pair | None | Public |
| `POST` | `/api/v1/auth/google` | Google OAuth 2.0 ID token verification and sign-in | None | Public |
| `POST` | `/api/v1/auth/refresh-token` | Exchange valid refresh token for a new access token | None | Public |
| `POST` | `/api/v1/auth/logout` | Revoke current refresh token and log out | Bearer | Authenticated |

### 3. Public Directory (`/public` or `/api/v1/public`)
| Method | Endpoint | Description | Auth | Role |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/api/v1/public/mechanics` | Paginated public mechanic list with search and facets | None | Public |
| `GET` | `/api/v1/public/mechanics/:id` | Full public mechanic profile, skills, and reviews | None | Public |
| `GET` | `/api/v1/public/stats` | Aggregated platform statistics (KPIs) | None | Public |
| `GET` | `/api/v1/public/reviews` | Latest verified customer reviews | None | Public |

### 4. Users (`/api/v1/users`)
| Method | Endpoint | Description | Auth | Role |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/api/v1/users/me` | Fetch authenticated user's profile | Bearer | Any |
| `PATCH` | `/api/v1/users/me` | Update personal profile details | Bearer | Any |
| `GET` | `/api/v1/users/me/summary` | Customer vehicle, request, and payment metrics | Bearer | `CUSTOMER` |

### 5. Vehicles (`/api/v1/vehicles`)
| Method | Endpoint | Description | Auth | Role |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | `/api/v1/vehicles` | Register a new vehicle to customer garage | Bearer | `CUSTOMER` |
| `GET` | `/api/v1/vehicles/me` | List customer's registered vehicles | Bearer | `CUSTOMER` |
| `GET` | `/api/v1/vehicles/:id` | Get specific vehicle details | Bearer | `CUSTOMER` |
| `PATCH` | `/api/v1/vehicles/:id` | Update vehicle make, model, or plate | Bearer | `CUSTOMER` |
| `DELETE` | `/api/v1/vehicles/:id` | Soft delete a vehicle | Bearer | `CUSTOMER` |

### 6. Mechanics & Telemetry (`/api/v1/mechanics`)
| Method | Endpoint | Description | Auth | Role |
| :--- | :--- | :--- | :---: | :---: |
| `PATCH` | `/api/v1/mechanics/me/availability` | Toggle availability (`AVAILABLE`, `BUSY`, `OFFLINE`) | Bearer | `MECHANIC` |
| `PATCH` | `/api/v1/mechanics/me/location` | Stream live GPS coordinates (`lat`, `lng`) | Bearer | `MECHANIC` |
| `GET` | `/api/v1/mechanics/me/earnings` | Mechanic lifetime and monthly earnings summary | Bearer | `MECHANIC` |
| `GET` | `/api/v1/mechanics/:mechanicId/reviews` | List reviews for a specific mechanic | Bearer | Any |

### 7. Mechanic Inventory (`/api/v1/mechanics/me/inventory`)
| Method | Endpoint | Description | Auth | Role |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | `/api/v1/mechanics/me/inventory` | Add catalog spare part to inventory with price & stock | Bearer | `MECHANIC` |
| `GET` | `/api/v1/mechanics/me/inventory` | List inventory items with stock & `lowStock` filter | Bearer | `MECHANIC` |
| `PATCH` | `/api/v1/mechanics/me/inventory/:sparePartId` | Update item price or stock level | Bearer | `MECHANIC` |
| `PATCH` | `/api/v1/mechanics/me/inventory/:sparePartId/restock` | Increment stock quantity | Bearer | `MECHANIC` |
| `DELETE` | `/api/v1/mechanics/me/inventory/:sparePartId` | Remove spare part from personal inventory | Bearer | `MECHANIC` |

### 8. Service Requests (`/api/v1/service-requests`)
| Method | Endpoint | Description | Auth | Role |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | `/api/v1/service-requests` | Create an emergency breakdown request | Bearer | `CUSTOMER` |
| `GET` | `/api/v1/service-requests/nearby-mechanics` | Find available mechanics near breakdown coords | Bearer | `CUSTOMER` |
| `GET` | `/api/v1/service-requests/my` | List customer's service request history | Bearer | `CUSTOMER` |
| `POST` | `/api/v1/service-requests/:id/assign` | Assign chosen mechanic to request | Bearer | `CUSTOMER` |
| `PATCH` | `/api/v1/service-requests/:id/cancel` | Cancel pending or assigned request | Bearer | `CUSTOMER` |
| `POST` | `/api/v1/service-requests/:id/images` | Upload breakdown damage photos (Cloudinary) | Bearer | `CUSTOMER` |
| `GET` | `/api/v1/service-requests/:id/images` | List uploaded damage photos | Bearer | Any |
| `GET` | `/api/v1/service-requests/assigned` | List service requests assigned to the mechanic | Bearer | `MECHANIC` |
| `POST` | `/api/v1/service-requests/:id/accept` | Accept assigned service ticket | Bearer | `MECHANIC` |
| `PATCH` | `/api/v1/service-requests/:id/status` | Advance status (`EN_ROUTE`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`) | Bearer | `MECHANIC` |
| `POST` | `/api/v1/service-requests/:id/parts` | Record spare parts used during repair | Bearer | `MECHANIC` |
| `GET` | `/api/v1/service-requests/:id` | Retrieve comprehensive request details | Bearer | Customer / Mechanic / Admin |
| `POST` | `/api/v1/service-requests/:id/review` | Submit rating & review for completed job | Bearer | `CUSTOMER` |
| `GET` | `/api/v1/service-requests/:id/review` | Fetch review for a service request | Bearer | Any |

### 9. Spare Parts Catalog (`/api/v1/spare-parts`)
| Method | Endpoint | Description | Auth | Role |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/api/v1/spare-parts` | List global spare parts with search | Bearer | Any |
| `GET` | `/api/v1/spare-parts/:id` | Get spare part details | Bearer | Any |
| `POST` | `/api/v1/spare-parts` | Add spare part to global catalog | Bearer | `ADMIN` |
| `PATCH` | `/api/v1/spare-parts/:id` | Update global catalog spare part | Bearer | `ADMIN` |
| `DELETE` | `/api/v1/spare-parts/:id` | Soft delete global spare part | Bearer | `ADMIN` |

### 10. Invoices (`/api/v1/invoices`)
| Method | Endpoint | Description | Auth | Role |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/api/v1/invoices/:id` | Retrieve itemized invoice breakdown | Bearer | Customer / Mechanic / Admin |

### 11. Payments (`/api/v1/payments`)
| Method | Endpoint | Description | Auth | Role |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | `/api/v1/payments/initiate` | Initialize SSLCommerz checkout session | Bearer | `CUSTOMER` |
| `GET` | `/api/v1/payments/my` | List customer payment history | Bearer | `CUSTOMER` |
| `GET` | `/api/v1/payments/:id` | Retrieve payment status and receipt | Bearer | Authenticated |
| `POST` | `/api/v1/payments/success` | SSLCommerz IPN success callback | None | Public |
| `POST` | `/api/v1/payments/fail` | SSLCommerz IPN failure callback | None | Public |
| `POST` | `/api/v1/payments/cancel` | SSLCommerz IPN cancel callback | None | Public |

### 12. Admin Management (`/api/v1/admin`)
| Method | Endpoint | Description | Auth | Role |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/api/v1/admin/users` | List all users with filtering & pagination | Bearer | `ADMIN` |
| `PATCH` | `/api/v1/admin/users/:id/role` | Change user role (`CUSTOMER`, `MECHANIC`, `ADMIN`) | Bearer | `ADMIN` |
| `PATCH` | `/api/v1/admin/users/:id/deactivate` | Deactivate user account (demo accounts protected) | Bearer | `ADMIN` |
| `PATCH` | `/api/v1/admin/users/:id/reactivate` | Reactivate user account | Bearer | `ADMIN` |
| `GET` | `/api/v1/admin/dashboard-stats` | Platform KPIs, monthly revenue & request trends | Bearer | `ADMIN` |
| `GET` | `/api/v1/admin/insights` | Operational insights and performance metrics | Bearer | `ADMIN` |
| `GET` | `/api/v1/admin/audit-logs` | Query system audit trail logs | Bearer | `ADMIN` |
| `GET` | `/api/v1/admin/service-requests` | System-wide service request monitoring | Bearer | `ADMIN` |
| `GET` | `/api/v1/admin/payments` | System-wide payment transaction oversight | Bearer | `ADMIN` |

---

## 📁 Project Folder Structure

```text
backend/
├── prisma/
│   ├── migrations/            # Tracked SQL database migrations
│   ├── schema.prisma          # Database models, enums & relational schema
│   └── seed.ts                # Idempotent database seeding script
├── src/
│   ├── config/                # Environment variables & cloud service configurations
│   │   ├── cloudinary.ts      # Cloudinary storage engine setup
│   │   ├── db.ts              # Prisma Client singleton
│   │   └── env.ts             # Zod environment variable parsing
│   ├── errors/                # Custom operational error definitions
│   │   └── AppError.ts        # AppError extending Error with statusCode
│   ├── middlewares/           # Global and route-level Express middlewares
│   │   ├── auth.middleware.ts # JWT verification & user attachment
│   │   ├── globalErrorHandler.ts # Centralized error formatting
│   │   ├── notFoundHandler.ts # 404 Route Not Found handler
│   │   ├── rateLimiter.ts     # IP rate limiters for auth, public & general
│   │   ├── rbac.middleware.ts # Role-Based Access Control enforcement
│   │   └── upload.middleware.ts # Multer file upload handler
│   ├── modules/               # Feature-based modular architecture
│   │   ├── admin/             # Admin oversight, KPIs, audit logs
│   │   ├── auth/              # Auth routes, JWT rotation, Google OAuth
│   │   ├── invoices/          # Invoice calculation & retrieval
│   │   ├── mechanic-inventory/# Per-mechanic spare parts inventory
│   │   ├── mechanics/         # Telemetry, availability, earnings
│   │   ├── payments/          # SSLCommerz gateway integration
│   │   ├── public/            # Public directory & stats
│   │   ├── reviews/           # Review creation & rating aggregation
│   │   ├── service-requests/  # Emergency dispatch & state transitions
│   │   ├── spare-parts/       # Global catalog management
│   │   ├── users/             # User profile endpoints
│   │   └── vehicles/          # Customer vehicle CRUD
│   ├── types/                 # Custom TypeScript declaration files
│   │   └── express.d.ts       # Express Request augmentation with user context
│   ├── utils/                 # Reusable utility functions
│   │   ├── formatZodError.ts  # Zod validation error formatter
│   │   ├── hashPassword.ts    # Bcrypt hashing & password comparison
│   │   ├── haversine.ts       # Distance calculation formula
│   │   ├── jwt.ts             # JWT signing and verification helpers
│   │   └── sendResponse.ts    # Standardized JSON response envelope
│   ├── app.ts                 # Express middleware configuration & route assembly
│   └── server.ts              # HTTP listener & server bootstrapping
├── .env.example               # Template for environment configuration
├── package.json               # Dependencies, scripts & engine requirements
└── tsconfig.json              # TypeScript compilation configuration
```

---

## 💻 Prerequisites

Ensure you have the following installed locally:
- **Node.js**: Version `20.x` or later (Node 22 LTS recommended)
- **npm**: Version `10.x` or later
- **PostgreSQL Database**: A running local PostgreSQL instance or a free cloud database on [Neon](https://neon.tech/)

---

## ⚙️ Installation & Local Setup

### 1. Clone the Backend Repository
```bash
git clone https://github.com/tasifhossan/RoadResQ-backend.git
cd RoadResQ-backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the `.env.example` file to create your local `.env`:
```bash
cp .env.example .env
```
Open `.env` and configure your database connection strings, JWT secrets, and API credentials.

---

## 🔐 Environment Variables

| Variable | Description | Example / Safe Placeholder | Required |
| :--- | :--- | :--- | :---: |
| `PORT` | Local server port | `5000` | No (default: 5000) |
| `NODE_ENV` | Runtime environment | `development` | No (default: development) |
| `FRONTEND_URL` | Frontend origin for CORS allowlist | `http://localhost:3000` | **Yes** |
| `DATABASE_URL` | Pooled PostgreSQL connection string (Neon) | `postgresql://user:pass@host-pooler/dbname?sslmode=require` | **Yes** |
| `DIRECT_URL` | Direct PostgreSQL connection string (for migrations) | `postgresql://user:pass@host-direct/dbname?sslmode=require` | **Yes** |
| `SHADOW_DATABASE_URL` | Shadow DB for Prisma migration dev | `postgresql://user:pass@host-direct/dbname?schema=prisma_shadow&sslmode=require` | No |
| `JWT_ACCESS_SECRET` | Secret key for signing Access Tokens (min 32 chars) | `your-secure-32-char-access-secret` | **Yes** |
| `JWT_ACCESS_EXPIRES_IN`| Expiry duration for Access Tokens | `15m` | No (default: 15m) |
| `JWT_REFRESH_SECRET` | Secret key for signing Refresh Tokens (min 32 chars)| `your-secure-32-char-refresh-secret`| **Yes** |
| `JWT_REFRESH_EXPIRES_IN`| Expiry duration for Refresh Tokens | `7d` | No (default: 7d) |
| `SSLCOMMERZ_STORE_ID` | SSLCommerz sandbox store ID | `your_store_id` | **Yes** |
| `SSLCOMMERZ_STORE_PASSWORD`| SSLCommerz sandbox store password | `your_store_password` | **Yes** |
| `SSLCOMMERZ_IS_LIVE` | Live vs Sandbox mode flag | `false` | No (default: false) |
| `SSLCOMMERZ_SUCCESS_URL`| Redirect URL on successful payment | `http://localhost:5000/api/v1/payments/success` | No |
| `SSLCOMMERZ_FAIL_URL` | Redirect URL on payment failure | `http://localhost:5000/api/v1/payments/fail` | No |
| `SSLCOMMERZ_CANCEL_URL` | Redirect URL on payment cancellation | `http://localhost:5000/api/v1/payments/cancel` | No |
| `CLOUDINARY_CLOUD_NAME`| Cloudinary account cloud name | `your_cloudinary_cloud_name` | **Yes** |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `your_cloudinary_api_key` | **Yes** |
| `CLOUDINARY_API_SECRET`| Cloudinary API secret | `your_cloudinary_api_secret` | **Yes** |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID | `your-client-id.apps.googleusercontent.com` | No (disables Google login if omitted) |
| `DEMO_PASSWORD` | Password assigned to seeded demo accounts | `DemoPassword123!` | No |

---

## 🗄️ Database Setup & Seeding

### 1. Generate Prisma Client
```bash
npx prisma generate
```

### 2. Push Schema or Run Migrations
- **For a fresh database**:
  ```bash
  npx prisma db push
  ```
- **For tracked migrations**:
  ```bash
  npx prisma migrate deploy
  ```

### 3. Seed Initial Demo Data
The seed script creates pre-configured demo users across all roles, customer vehicles, global spare parts catalog, mechanic inventory, and sample service requests:
```bash
npm run seed
```

#### Demo Credentials Created:
| Role | Email | Password (from `DEMO_PASSWORD`) |
| :--- | :--- | :--- |
| **`ADMIN`** | `admin@roadresq-demo.com` | `DemoPassword123!` |
| **`CUSTOMER`** | `customer@roadresq-demo.com` | `DemoPassword123!` |
| **`MECHANIC`** | `mechanic@roadresq-demo.com` | `DemoPassword123!` |

> ℹ️ **Demo Account Protection**: Demo accounts are protected against deactivation and role modification via route validation rules. Re-running `npm run seed` idempotently restores demo accounts.

---

## 📜 Available Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `tsx watch src/server.ts` | Starts backend with hot-reload for local development |
| `npm run build` | `prisma generate && tsc` | Generates Prisma client and compiles TypeScript to `dist/` |
| `npm run start` | `node dist/server.js` | Runs compiled production server |
| `npm run test` | `tsx --test src/**/*.test.ts` | Executes Node.js built-in test runner |
| `npm run lint` | `eslint src/**/*.ts` | Runs ESLint to check code quality |
| `npm run lint:fix` | `eslint src/**/*.ts --fix` | Automatically fixes ESLint warnings |
| `npm run format` | `prettier --write "src/**/*.ts"` | Formats TypeScript source files using Prettier |
| `npm run prisma:generate` | `prisma generate` | Generates Prisma Client types |
| `npm run prisma:migrate` | `prisma migrate dev` | Creates and applies new database migrations |
| `npm run prisma:seed` | `tsx prisma/seed.ts` | Executes database seed script |
| `npm run seed` | `prisma db seed` | Prisma CLI shortcut to run database seeding |

---

## 🧪 Testing & Quality Assurance

Run the test suite using:
```bash
npm test
```

To run linter checks and type validation:
```bash
npm run lint
npx tsc --noEmit
```

---

## 🌐 External Integrations

1. **[Neon Database](https://neon.tech/)**: Serverless cloud PostgreSQL providing connection pooling for low-latency queries and direct connection endpoints for schema migrations.
2. **[Cloudinary](https://cloudinary.com/)**: Cloud media storage used by customers to upload scene photographs of vehicle damage (`multer-storage-cloudinary`).
3. **[SSLCommerz](https://sslcommerz.com/)**: Bangladesh's leading payment gateway integrated via sandbox mode for credit card, debit card, and mobile banking test transactions.
4. **[Google Identity Services](https://developers.google.com/identity)**: OAuth 2.0 token verification using `google-auth-library` for Google sign-in.

---

## 🔗 Frontend Integration

The backend is consumed by the **RoadResQ Frontend** web application:

- **Frontend Repository**: [https://github.com/tasifhossan/RoadResQ](https://github.com/tasifhossan/RoadResQ)
- **Local Dev Connection**: Set `BACKEND_URL="http://localhost:5000/api/v1"` in the frontend's `.env.local`.
- **CORS Setup**: The backend dynamically accepts `http://localhost:3000` and the configured `FRONTEND_URL` in `app.ts`.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the **ISC License** — see the [`package.json`](./package.json) file for details.

---

## 👨‍💻 Contact & Author

- **Author**: Tasif Hossan
- **Email**: [tasifhossan@gmail.com](mailto:tasifhossan@gmail.com)
- **GitHub**: [@tasifhossan](https://github.com/tasifhossan)
- **Portfolio**: [https://tasif-portfolio.vercel.app](https://tasif-portfolio.vercel.app)
- **Live Backend API**: [https://road-res-q-backend.vercel.app](https://road-res-q-backend.vercel.app)
