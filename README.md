# RANEEV

### Rapid Assistance Network for Emergency & Essential Volunteerism

> **Help shouldn't wait for distance.**

RANEEV is a **community-powered emergency response platform** that connects people in distress with nearby, **verified volunteers** who can provide immediate assistance before professional responders arrive.

It is designed around the critical response gap between **the moment an emergency occurs and the arrival of professional help**, with particular focus on **rural and underserved communities**.

---

## Overview

RANEEV adds a human-response layer to traditional emergency systems by identifying people nearby who are **available, verified, and relevant to the emergency**.

The platform combines:

- Real-time location
- Verified community responders
- Skill-aware responder matching
- Emergency notifications
- Live responder tracking
- Incident state management
- Administrative verification and monitoring

```text
Emergency
    ↓
Location Captured
    ↓
Nearby Responders Discovered
    ↓
Intelligent Matching
    ↓
Verified Responder Notified
    ↓
Responder Accepts
    ↓
Live Tracking
    ↓
Immediate Assistance
    ↓
Professional Help Arrives
```

---

# Core Features

## ERN — Emergency Response Network

ERN is RANEEV's rapid-response mode for urgent incidents.

```text
Activate ERN
     ↓
Capture Location
     ↓
Select Emergency Type
     ↓
Find Nearby Verified Responders
     ↓
Send Alerts
     ↓
Responder Accepts
     ↓
Live Tracking
```

## GHR — Golden Hour Response

GHR is designed for **accidents and medical emergencies** where trained responders should be prioritized.

```text
Activate GHR
     ↓
Capture Location
     ↓
Classify Emergency
     ↓
Prioritize Trained Responders
     ↓
Send Alerts
     ↓
Responder Accepts
     ↓
Live Tracking
     ↓
Continuous Incident Coordination
```

## Volunteer Mode

Verified community members can become active responders.

Volunteers can:

- Create a responder profile
- Provide skills
- Complete verification
- Set availability and response radius
- Receive nearby emergency requests
- Accept/reject incidents
- Share location during active response
- Update response status

## Intelligent Responder Matching

RANEEV does not simply select the closest person.

| Factor | Weight |
|---|---:|
| Distance | 40% |
| Skill Match | 30% |
| Availability | 20% |
| Verification | 10% |

```text
Emergency
    ↓
Available Responders
    ↓
Verification Filter
    ↓
Geographic Filter
    ↓
Skill Compatibility
    ↓
Match Scoring
    ↓
Ranked Responders
    ↓
Emergency Notification
```

The weighting is configurable.

---

# Technical Architecture

```text
                       ┌────────────────────────┐
                       │    RANEEV Web App      │
                       │ React + TypeScript     │
                       └───────────┬────────────┘
                                   │
                           HTTPS / WebSocket
                                   │
                       ┌───────────▼────────────┐
                       │       FastAPI          │
                       │ Authentication         │
                       │ Emergency Service      │
                       │ Matching Engine        │
                       │ Tracking Service       │
                       │ Volunteer Service      │
                       │ Notification Service   │
                       │ Admin Service          │
                       └──────────┬───────┬─────┘
                                  │       │
                     ┌────────────▼──┐  ┌─▼──────────────┐
                     │  PostgreSQL   │  │ WebSocket      │
                     │  Database     │  │ Realtime       │
                     └───────────────┘  └────────────────┘
                                  │
                        ┌─────────▼─────────┐
                        │ External Services │
                        │ Maps / Messaging  │
                        └───────────────────┘
```

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js + TypeScript |
| Styling | Tailwind CSS |
| Backend | Python + FastAPI |
| ORM | SQLAlchemy |
| Database | PostgreSQL |
| Validation | Pydantic |
| Authentication | JWT |
| Real-time | WebSockets |
| Maps | Google Maps API / equivalent |
| Notifications | Firebase Cloud Messaging / equivalent |
| API Documentation | OpenAPI / Swagger |
| Containerization | Docker |
| Testing | Pytest + frontend testing tools |

---

# Repository Structure

```text
raneev/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   └── utils/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── emergencies/
│   │   │   ├── responders/
│   │   │   ├── tracking/
│   │   │   └── admin/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── websocket/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── alembic.ini
│
├── docs/
│   ├── PRD.md
│   ├── TRD.md
│   ├── BMC.md
│   ├── Implementation_plan.md
│   └── Backend_Schema.md
│
├── docker/
├── .env.example
├── docker-compose.yml
└── README.md
```

---

# Emergency Lifecycle

```text
ACTIVE
  ↓
SEARCHING
  ↓
ACCEPTED
  ↓
EN_ROUTE
  ↓
ARRIVED
  ↓
ASSISTING
  ↓
RESOLVED
```

Alternative terminal state:

```text
CANCELLED
```

The backend is the authoritative source of emergency state.

---

# Database

PostgreSQL is the primary data store.

### Core Tables

```text
users
volunteer_profiles
skills
volunteer_skills
emergencies
emergency_responders
location_updates
notifications
incident_events
audit_logs
```

### Simplified Relationship

```text
USERS
  │
  ├── VOLUNTEER_PROFILES
  │       └── VOLUNTEER_SKILLS ── SKILLS
  │
  ├── EMERGENCIES
  │       ├── EMERGENCY_RESPONDERS
  │       ├── LOCATION_UPDATES
  │       ├── NOTIFICATIONS
  │       └── INCIDENT_EVENTS
  │
  └── AUDIT_LOGS
```

---

# API Overview

## Authentication

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

## Emergencies

```http
POST  /api/emergencies
GET   /api/emergencies/{id}
PATCH /api/emergencies/{id}/status
POST  /api/emergencies/{id}/cancel
POST  /api/emergencies/{id}/resolve
```

## Responders

```http
GET   /api/responders/nearby
PATCH /api/responders/availability
POST  /api/responders/profile
POST  /api/emergencies/{id}/accept
POST  /api/emergencies/{id}/reject
POST  /api/emergencies/{id}/arrive
POST  /api/emergencies/{id}/assist
```

## Administration

```http
GET   /api/admin/emergencies
GET   /api/admin/volunteers
GET   /api/admin/users
PATCH /api/admin/volunteers/{id}/verify
PATCH /api/admin/volunteers/{id}/suspend
GET   /api/admin/audit-logs
GET   /api/admin/metrics
```

## Real-Time

```http
WS /api/ws/emergency/{emergency_id}
```

---

# Security & Privacy

Because RANEEV handles emergency and location information, security is a core system requirement.

- JWT-based authentication
- Role-based access control
- Strong password hashing
- HTTPS
- API validation
- Rate limiting
- Secure CORS configuration
- Environment-based secret management
- Database access control
- WebSocket authorization
- Location access restrictions
- Audit logging

> **Only authorized participants should receive emergency-specific location information.**

Exact location history should not be exposed unnecessarily after an incident has ended.

---

# Reliability

RANEEV is designed to handle:

- Responder rejection
- Multiple responders attempting acceptance
- GPS failure
- WebSocket disconnections
- Notification failure
- Network instability
- User refresh/reconnect
- No-responder scenarios

PostgreSQL remains the authoritative source for emergency state.

---

# Poor Connectivity

The MVP includes:

- Request retry
- WebSocket reconnect
- Location retry
- Local state preservation
- Connection status indicators

Future improvements:

- SMS fallback
- Low-bandwidth mode
- Offline emergency creation
- Additional communication channels

---

# Getting Started

## Prerequisites

Install:

- Node.js
- Python 3.11+
- PostgreSQL
- Git
- Docker (recommended)

## 1. Clone

```bash
git clone https://github.com/<your-username>/raneev.git
cd raneev
```

## 2. Configure Environment

```bash
cd backend
cp .env.example .env
```

Example:

```env
DATABASE_URL=
JWT_SECRET=
JWT_ALGORITHM=
ACCESS_TOKEN_EXPIRE_MINUTES=
REFRESH_TOKEN_EXPIRE_DAYS=
MAP_API_KEY=
FIREBASE_PROJECT_ID=
CORS_ORIGINS=
```

Never commit production secrets.

## 3. Backend

```bash
cd backend
python -m venv .venv
```

### Windows

```bash
.venv\Scripts\activate
```

### Linux/macOS

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run migrations:

```bash
alembic upgrade head
```

Start FastAPI:

```bash
uvicorn app.main:app --reload
```

API documentation:

```text
http://localhost:8000/docs
```

## 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Development frontend:

```text
http://localhost:5173
```

## 5. Docker

```bash
docker compose up --build
```

---

# Testing

## Backend

```bash
cd backend
pytest
```

## Frontend

```bash
npm test
```

### Critical E2E Scenarios

```text
Create Emergency
      ↓
Find Responder
      ↓
Responder Accepts
      ↓
Live Tracking
      ↓
Responder Arrives
      ↓
Resolve Incident
```

Also test:

```text
Responder A Rejects → Responder B Accepts
No Responder → Radius Expansion → Escalation
Connection Loss → Recovery → Tracking Resumes
```

---

# MVP Status

## Included

- [x] User authentication
- [x] Role-based access
- [x] Volunteer registration
- [x] Volunteer verification
- [x] Volunteer availability
- [x] ERN
- [x] GHR
- [x] Emergency creation
- [x] GPS location
- [x] Responder matching
- [x] Responder acceptance
- [x] Emergency state machine
- [x] Real-time tracking
- [x] Notifications
- [x] Admin monitoring
- [x] Emergency history
- [x] Audit logging

## Planned

- [ ] SMS fallback
- [ ] Native Android/iOS applications
- [ ] Hospital integrations
- [ ] Ambulance-provider integrations
- [ ] Multi-responder incident coordination
- [ ] AI-assisted prioritization
- [ ] Predictive responder positioning
- [ ] Advanced analytics
- [ ] Government/public-safety integrations

---

# Roadmap

### Phase 1 — Foundation

Repository, frontend, FastAPI, PostgreSQL, authentication, database models.

### Phase 2 — Responder Network

Volunteer profiles, skills, verification, availability and admin verification.

### Phase 3 — Emergency Core

ERN, GHR, emergency lifecycle, geolocation and matching engine.

### Phase 4 — Real-Time Response

Notifications, responder acceptance, WebSockets, live tracking and incident timeline.

### Phase 5 — Operations

Admin dashboard, audit logs, security hardening, testing and deployment.

### Phase 6 — Scale

Low-bandwidth improvements, SMS fallback, mobile applications, healthcare integrations and regional responder networks.

---

# USP

> **RANEEV is the human response layer between an emergency and professional help—using verified local responders, intelligent proximity-and-skill matching, and real-time coordination to deliver assistance during the critical response gap.**

### In One Line

**Verified People + Location Intelligence + Skill Matching + Real-Time Coordination = Community-Powered First Response**

### Positioning

Traditional systems:

```text
Emergency
   ↓
Professional Dispatch
   ↓
Responder Arrival
```

RANEEV adds:

```text
Emergency
   ↓
Professional Dispatch
        +
Nearby Verified Community Response
   ↓
Immediate Assistance
   ↓
Professional Responder Arrival
```

RANEEV is **not intended to replace ambulances, hospitals, police, firefighters, or other professional emergency services**. It is designed to complement them.

---

# Key Metrics

Primary metric:

> **Emergency activation → responder acceptance time**

Supporting metrics:

- Responder arrival time
- Successful match rate
- Emergency resolution rate
- Verified responder density
- Volunteer retention
- Location tracking reliability
- Notification delivery rate
- False-emergency rate
- Rural response coverage

---

# Documentation

The project documentation should be maintained under `/docs`:

- `PRD.md` — Product Requirements Document
- `TRD.md` — Technical Requirements Document
- `BMC.md` — Business Model Canvas
- `Implementation_plan.md` — Implementation Plan
- `Backend_Schema.md` — Backend Schema

---

# Contributing

Contributions are welcome.

```bash
git checkout -b feature/your-feature
```

Before submitting a pull request:

- Ensure the application builds.
- Run backend and frontend tests.
- Verify API behavior.
- Check authentication and authorization.
- Do not commit secrets or personal emergency data.

---

# Security

If you discover a security vulnerability, report it privately through the repository's designated security/contact channel.

Never include real emergency records, personal location history, identity documents, or authentication secrets in commits or test fixtures.

---

# Disclaimer

RANEEV is a **community emergency-response coordination platform**.

It is not a replacement for professional emergency services and should not be represented as a medical diagnosis, emergency-service dispatch, or guaranteed life-saving system.

Volunteer assistance must remain subject to appropriate verification, safety procedures, applicable laws, and professional emergency-response guidance.

---

# License

Add the project's chosen open-source license here.

Example:

```text
MIT License
```

---

<p align="center">
  <strong>RANEEV</strong><br>
  Rapid Assistance Network for Emergency & Essential Volunteerism
</p>
