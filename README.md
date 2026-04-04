# Denim Hacksagon

A modern HR and productivity platform combining a React/Tailwind frontend, Node.js/Express backend, PostgreSQL database, and AI assistant support.

## Project Overview

This repository delivers a full-stack HR management system with employee administration, attendance tracking, leave workflows, payroll processing, task management, client collaboration, Jira integration, and a retrieval-augmented generation (RAG) AI assistant.

The RAG assistant is powered from local document assets in `rag_model/pathway/client` and `rag_model/pathway/data`, and it is served through backend assistant routes for threaded conversational workflows.

The project is built for fast development and clean user experiences while supporting real-time HR operations, reporting, and conversational AI assistance.

## Key Features

- **User authentication and role-based access**
  - Secure login for HR, employees, and clients
  - Protected routes and session management

- **Employee and profile management**
  - Employee directory and HR directory views
  - Editable user profiles with team and contact details

- **Attendance and time tracking**
  - Daily attendance logging
  - Attendance history and reporting support

- **Leave request and approval workflows**
  - Submit leave requests from the employee portal
  - Review and approve or reject requests via HR dashboard
  - Approvals tracking and status management

- **Payroll management**
  - Payroll data management for HR teams
  - Payment summaries and payroll processing workflows

- **Client project management**
  - Client project listing and collaboration support
  - Client-facing features for better transparency

- **Task board and workflow automation**
  - Task creation, assignment, and board management
  - Workflow automation via scheduled background tasks

- **Jira integration**
  - Jira connection support for issue and project synchronization
  - HR and task coordination tied to Jira data

- **HR connections and network management**
  - Connection management for HR contacts and client relationships
  - Built-in HR collaboration tools

- **Intelligent assistant with document access**
  - AI assistant threads and conversational history
  - Document serving from `rag_model/pathway/client` and `rag_model/pathway/data`
  - Assistant statistics, thread creation, and cleanup endpoints

- **File uploads and notifications**
  - File upload handling with `multer`
  - Email notifications via `nodemailer`
  - Scheduled background jobs using `node-cron`

## Tech Stack

- Frontend
  - React 18
  - TypeScript
  - Vite
  - Tailwind CSS
  - Radix UI primitives
  - React Router DOM
  - React Hook Form
  - Framer Motion
  - Recharts
  - TanStack React Query

- Backend
  - Node.js
  - Express 5
  - JWT authentication
  - PostgreSQL (`pg`)
  - CORS, cookie parsing, file uploads
  - Nodemailer for email
  - Node Cron for scheduled workflows

- AI / RAG Support
  - Local assistant document serving from `rag_model`
  - Assistant routes for threaded conversational AI

- Python / ML Support
  - `requirements.txt` includes dependencies for the `rag_model` and model-serving environment

## Repository Structure

- `web/frontend/` — React + Vite + TypeScript frontend application
- `web/backend/` — Node.js Express API server and HR backend logic
- `rag_model/` — RAG assistant assets and data sources
- `requirements.txt` — Python dependencies for the AI/model environment

## Getting Started

### Backend

```bash
cd web/backend
npm install
cp .env.example .env
# Update .env with your PostgreSQL, JWT, and email settings
npm run dev
```

### Frontend

```bash
cd web/frontend
npm install
npm run dev
```

### Optional AI / Assistant Data

If you are using the assistant integration, the backend exposes:

- `/assistant-documents` for RAG document assets
- `/assistant-data` for assistant data resources

## Environment Variables

This project uses separate env examples for each layer:

- `web/backend/.env.example`
- `web/frontend/.env.example`
- `rag_model/pathway/.env.example`
- `.env.example` at the repo root for consolidated reference

### Backend `.env.example`

```env
DB_USER=
DB_HOST=
DB_DATABASE=
DB_PASSWORD=
DB_PORT=
JWT_SECRET=
PATHWAY_URL=http://localhost:8000
JIRA_DOMAIN=
JIRA_EMAIL=
JIRA_API_TOKEN=
JIRA_PROJECT_KEY=
HR_GMAIL_APP_PASSWORD=
HR_GMAIL_USER=
```

### Frontend `.env.example`

```env
VITE_API_URL=http://localhost:3001/api/v1
```

### RAG model `.env.example`

```env
HUGGINGFACE_API_KEY="hf..."
GOOGLE_APPLICATION_CREDENTIALS="credentials.json"
DRIVE_ID="1Cy..."
```

## Role-Based UI Overview

The app supports multiple roles with dedicated screens and dashboards. Add role-specific screenshot assets in `docs/images` and update the image paths below when you have real UI captures.

### Employee Dashboard

![WhatsApp Image 2026-04-05 at 1 12 41 AM](https://github.com/user-attachments/assets/d1f9cc37-27c3-4ca0-8562-b21e63c5f4d0)

![WhatsApp Image 2026-04-05 at 1 15 12 AM](https://github.com/user-attachments/assets/d46bd2cd-e61b-4034-a6dd-ca2c91f38cec)

![WhatsApp Image 2026-04-05 at 1 15 23 AM](https://github.com/user-attachments/assets/1097fb35-22ba-475b-a8e6-86ec260cf01d)

![WhatsApp Image 2026-04-05 at 1 15 29 AM](https://github.com/user-attachments/assets/2e914432-04df-4ba9-9aa3-aed3f4ff267d)

### HR Portal

![WhatsApp Image 2026-04-05 at 1 12 20 AM](https://github.com/user-attachments/assets/9394fa13-e7bb-46b7-9196-7ac64ce614fc)

![WhatsApp Image 2026-04-05 at 1 02 33 AM](https://github.com/user-attachments/assets/0f0188d1-cd7a-476a-bdb5-d955078cabdc)

![WhatsApp Image 2026-04-05 at 1 03 27 AM](https://github.com/user-attachments/assets/e8eb71cb-9680-47d0-af9b-0202ddf0a5cc)

![WhatsApp Image 2026-04-05 at 1 03 49 AM](https://github.com/user-attachments/assets/63f4abfe-6033-4cd0-a83a-027209123eb3)

![WhatsApp Image 2026-04-05 at 1 07 32 AM](https://github.com/user-attachments/assets/723fde2d-389d-4afb-92a6-187854093d71)


### Client Portal

![WhatsApp Image 2026-04-05 at 12 58 21 AM](https://github.com/user-attachments/assets/be80896c-8221-4479-b852-6edc42370c5c)

![WhatsApp Image 2026-04-05 at 12 59 21 AM](https://github.com/user-attachments/assets/5c500d43-3fde-4edd-93ed-0b4eda655f80)

![WhatsApp Image 2026-04-05 at 12 59 45 AM](https://github.com/user-attachments/assets/8139145e-7147-4805-a3b3-854282af1a30)




## Useful Scripts

- Frontend development: `npm run dev`
- Frontend build: `npm run build`
- Backend development: `npm run dev`
- Backend start: `npm start`

## Notes

- This project is organized to separate frontend and backend concerns.
- The backend initializes database schema and task scheduler automatically on startup.
- The assistant feature is tightly integrated with `rag_model` assets and supports thread management.

## License

This project is provided as-is. Add your preferred license details here.
