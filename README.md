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

### HR Dashboard

![alt text](<docs/images/WhatsApp Image 2026-04-05 at 12.57.26 AM.jpeg>)

### Employee Portal

![Employee Portal](docs/images/employee-portal.png)

### Client Portal




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
