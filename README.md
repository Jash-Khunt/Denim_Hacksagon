# Denim Hacksagon

A modern HR and productivity platform combining a React/Tailwind frontend, Node.js/Express backend, PostgreSQL database, and AI assistant support.

## Project Overview

This repository delivers a full-stack HR management system with employee administration, attendance tracking, leave workflows, payroll processing, task management, client collaboration, Jira integration, and a retrieval-augmented generation (RAG) AI assistant.

The RAG assistant is powered from local document assets in `rag_model/pathway/client` and `rag_model/pathway/data`, and it is served through backend assistant routes for threaded conversational workflows.

The project is built for fast development and clean user experiences while supporting real-time HR operations, reporting, and conversational AI assistance.

## Key Features

- **JIRA Integration & Task Management**
  - Bot output is parsed into structured task JSON with normalized difficulty, flags, due dates, and priorities
  - Tasks are inserted into workflow database (project_tasks) for seamless tracking
  - Jira controller creates issues from tasks with optional sprint/assignee assignment
  - Frontend task board consumes and displays created Jira tickets for real-time collaboration

- **HR Summary Dashboard**
  - Comprehensive HR analytics and reporting with employee metrics, attendance summaries, and leave statistics
  - Real-time dashboard updates for HR decision-making and workforce insights
  - Integration with payroll and performance data for holistic HR management

- **Smart Alert System**
  - Intelligent notification system for task deadlines, leave approvals, and HR actions
  - Automated reminders based on due dates with employee-specific grouping
  - Asynchronous checks triggered by task updates and daily cron scheduler for proactive alerts

- **Citation & Document Intelligence**
  - Advanced citation tracking and source referencing in assistant responses
  - Document indexing with metadata for accurate information retrieval
  - Pathway filesystem reader integration for comprehensive document processing

- **Large Document Summarization**
  - Heavy-duty RAG model capable of processing and summarizing extensive documents
  - Chunk-based indexing and retrieval for handling large-scale content efficiently
  - Optimized for performance with significant computational resources for deep analysis

- **Intelligent Assistant with Graph Rendering**
  - AI assistant powered by retrieval-augmented generation (RAG) with document access
  - Message parser scans for [GRAPH_CONFIG] to render bar/line/pie charts from valid payloads
  - Threaded conversational workflows with statistics tracking and cleanup endpoints

- **Email Notification System**
  - Due dates stored on tasks with HR-triggered reminders via API (/tasks/reminders/due-in-two-days)
  - Backend groups due/overdue tasks by employee and sends personalized email notifications
  - Asynchronous reminder-window checks and daily cron scheduler for automated communication

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
  - Multi-service Pathway architecture with separate endpoints for main RAG, tickets, and dashboard
  - Heavy-duty retrieval-augmented generation model with Pathway filesystem reader for metadata-rich document processing
  - Document store with chunk-based indexing and retrieval optimized for large-scale content analysis
  - Statistics endpoint exposed for indexing metrics and performance monitoring
  - Streamlit web interface for direct RAG interaction
  - Significant computational resources required for deep document summarization and intelligent citation tracking

- Python / ML Support
  - `requirements.txt` includes dependencies for the `rag_model` and model-serving environment

## Repository Structure

- `web/frontend/` — React + Vite + TypeScript frontend application
- `web/backend/` — Node.js Express API server and HR backend logic
- `rag_model/pathway/` — RAG assistant implementation with multiple services
  - `app.py` — Main Pathway application
  - `app.yaml`, `ticket.yaml`, `dashboard.yaml` — Service configurations
  - `client/` — Document storage directory
  - `data/` — Additional data directory
  - `streamlit_ui/` — Streamlit web interface for RAG
- `requirements.txt` — Python dependencies for the AI/model environment
- `docs/images/` — Screenshots and documentation images

## Getting Started

### Prerequisites

- Node.js (v18+)
- Python (v3.8+)
- PostgreSQL database
- Git

### Backend Setup

```bash
cd web/backend
npm install
cp .env.example .env
# Update .env with your PostgreSQL, JWT, and email settings
npm run dev
```

The backend will start on `http://localhost:3001`

### Frontend Setup

```bash
cd web/frontend
npm install
cp .env.example .env
# Update VITE_API_URL if needed (defaults to http://localhost:3001/api/v1)
npm run dev
```

The frontend will start on `http://localhost:8080`

### RAG Model Setup

The project uses multiple Pathway services for AI assistance:

```bash
# Install Python dependencies
pip install -r requirements.txt

# Navigate to RAG model directory
cd rag_model/pathway

# Copy environment file
cp .env.example .env
# Update with your HuggingFace API key and Google credentials

# Start the main Pathway service (port 8000)
python app.py

# In separate terminals, start additional services:
# Ticket service (port 8001)
python app.py --config ticket.yaml --port 8001

# Dashboard service (port 8002)
python app.py --config dashboard.yaml --port 8002

# Optional: Start Streamlit UI
cd streamlit_ui
streamlit run ui.py
```

### Environment Variables

Update the following key environment variables:

**Backend (.env):**

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `DB_PORT` - PostgreSQL connection
- `JWT_SECRET` - JWT signing key
- `PATHWAY_URL=http://localhost:8000` - Main Pathway service
- `PATHWAY_TICKET_URL=http://localhost:8001` - Ticket service
- `PATHWAY_DASHBOARD_URL=http://localhost:8002` - Dashboard service
- `HR_GMAIL_USER`, `HR_GMAIL_APP_PASSWORD` - Email credentials

**Frontend (.env):**

- `VITE_API_URL=http://localhost:3001/api/v1` - Backend API URL

**RAG Model (.env):**

- `HUGGINGFACE_API_KEY` - HuggingFace API key
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to Google credentials JSON
- `DRIVE_ID` - Google Drive folder ID for documents

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

### Development Commands

**Backend:**

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server

**Frontend:**

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

**RAG Model:**

- `python app.py` - Start main Pathway service (port 8000)
- `python app.py --config ticket.yaml` - Start ticket service (port 8001)
- `python app.py --config dashboard.yaml` - Start dashboard service (port 8002)
- `streamlit run streamlit_ui/ui.py` - Start Streamlit UI

### Service URLs

- Backend API: `http://localhost:3001`
- Frontend: `http://localhost:8080`
- Pathway Main: `http://localhost:8000`
- Pathway Tickets: `http://localhost:8001`
- Pathway Dashboard: `http://localhost:8002`
- Streamlit UI: `http://localhost:8501` (default Streamlit port)

## Notes

- This project is organized to separate frontend and backend concerns.
- The backend initializes database schema and task scheduler automatically on startup.
- The assistant feature is tightly integrated with `rag_model` assets and supports thread management.

## License

This project is provided as-is. Add your preferred license details here.
