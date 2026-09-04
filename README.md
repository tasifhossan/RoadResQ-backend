# RoadResQ Backend API

**RoadResQ** is a Mobile Vehicle Repair & Roadside Assistance REST API backend built with Node.js, TypeScript, Express.js, and Prisma ORM with Neon PostgreSQL.

## Features (Phase 1)
- Modular Express + TypeScript architecture
- Standardized API response envelopes & global error handling
- Database schema built with Prisma ORM (Neon PostgreSQL)
- Sample database seed script with realistic data
- Endpoint: `GET /api/v1/health` for monitoring & initial deployment health checks

## Tech Stack
- **Runtime & Framework**: Node.js, TypeScript, Express.js
- **Database**: PostgreSQL (hosted on Neon) via Prisma ORM
- **Deployment**: Render / Vercel ready

## Setup & Running

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Copy `.env.example` to `.env` and set your `DATABASE_URL`:
   ```bash
   cp .env.example .env
   ```

3. **Database Migration & Seed**:
   ```bash
   npx prisma migrate dev
   npm run prisma:seed
   ```

4. **Development Server**:
   ```bash
   npm run dev
   ```

5. **Health Check Endpoint**:
   ```http
   GET http://localhost:5000/api/v1/health
   ```
