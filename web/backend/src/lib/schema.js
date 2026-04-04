import { pool } from "./db.js";

const workflowSchemaSql = `
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  ALTER TABLE client_project_uploads
  DROP CONSTRAINT IF EXISTS client_project_uploads_upload_source_check;

  ALTER TABLE client_project_uploads
  ADD CONSTRAINT client_project_uploads_upload_source_check
    CHECK (upload_source IN ('local', 'assistant'));

  ALTER TABLE client_project_uploads
  ADD COLUMN IF NOT EXISTS bot_raw_response TEXT;

  ALTER TABLE client_project_uploads
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITHOUT TIME ZONE;

  CREATE SEQUENCE IF NOT EXISTS project_task_ticket_seq START 1;

  CREATE TABLE IF NOT EXISTS project_tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES client_project_uploads(upload_id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES client(client_id) ON DELETE CASCADE,
    hr_id UUID NOT NULL REFERENCES hr(hr_id) ON DELETE CASCADE,
    assignee_emp_id UUID REFERENCES employee(emp_id) ON DELETE SET NULL,
    ticket_number BIGINT NOT NULL DEFAULT nextval('project_task_ticket_seq') UNIQUE,
    task_key VARCHAR(50) NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    difficulty VARCHAR(20) NOT NULL
      CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    field VARCHAR(120) NOT NULL,
    confidence_flag VARCHAR(10) NOT NULL
      CHECK (confidence_flag IN ('High', 'Low')),
    human_intervention BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'todo'
      CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
    assignment_mode VARCHAR(20) NOT NULL DEFAULT 'unassigned'
      CHECK (assignment_mode IN ('auto', 'manual', 'unassigned')),
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium'
      CHECK (priority IN ('Low', 'Medium', 'High')),
    due_date DATE,
    source VARCHAR(20) NOT NULL DEFAULT 'chatbot'
      CHECK (source IN ('chatbot', 'manual')),
    created_by_role VARCHAR(20) NOT NULL DEFAULT 'client'
      CHECK (created_by_role IN ('hr', 'client', 'employee', 'system')),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_project_tasks_hr_status
    ON project_tasks (hr_id, status);

  CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee
    ON project_tasks (assignee_emp_id);

  CREATE INDEX IF NOT EXISTS idx_project_tasks_upload
    ON project_tasks (upload_id);

  CREATE TABLE IF NOT EXISTS project_task_comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES project_tasks(task_id) ON DELETE CASCADE,
    author_role VARCHAR(20) NOT NULL
      CHECK (author_role IN ('hr', 'employee', 'client', 'system')),
    author_name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_project_task_comments_task
    ON project_task_comments (task_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS assistant_threads (
    thread_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_role VARCHAR(20) NOT NULL
      CHECK (user_role IN ('hr', 'employee', 'client')),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'New conversation',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_assistant_threads_owner
    ON assistant_threads (user_role, user_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS assistant_questions (
    question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES assistant_threads(thread_id) ON DELETE CASCADE,
    user_role VARCHAR(20) NOT NULL
      CHECK (user_role IN ('hr', 'employee', 'client')),
    user_id UUID NOT NULL,
    query TEXT NOT NULL,
    response TEXT NOT NULL DEFAULT '',
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    context_docs JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'answered', 'error')),
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_assistant_questions_thread
    ON assistant_questions (thread_id, created_at ASC);

  CREATE INDEX IF NOT EXISTS idx_assistant_questions_owner
    ON assistant_questions (user_role, user_id, created_at DESC);
`;

export const ensureWorkflowSchema = async () => {
  try {
    await pool.query(workflowSchemaSql);
    console.log("Workflow schema is ready");
  } catch (error) {
    console.error("Failed to ensure workflow schema:", error.message);
    throw error;
  }
};
