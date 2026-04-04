CREATE TABLE hr (
  hr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  company_name VARCHAR(100) NOT NULL,
  logo VARCHAR(255) NOT NULL,
  profile_picture VARCHAR(255),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE TABLE employee (
  emp_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hr_id UUID REFERENCES hr(hr_id) ON DELETE CASCADE, 
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  profile_picture VARCHAR(255),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);


CREATE TABLE profile_info (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	hr_id UUID REFERENCES hr(hr_id) ON DELETE CASCADE,
	emp_id UUID REFERENCES employee(emp_id) ON DELETE CASCADE,
	department VARCHAR(100),
  	location VARCHAR(100),
	summary VARCHAR(1000),
	skills TEXT,
	certificates TEXT,
	salary NUMERIC(12),
	date_of_birth DATE,
  	address TEXT,
  	nationality VARCHAR(50),
  	personal_email VARCHAR(120),
  	gender VARCHAR(20),
  	marital_status VARCHAR(20),
  	date_of_joining DATE,
	bank_name VARCHAR(120),
  	account_number VARCHAR(30),
  	ifsc_code VARCHAR(20),
  	pan_no VARCHAR(20),
	emp_code VARCHAR(30),
	created_at TIMESTAMP DEFAULT NOW(),
  	updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE attendance (
  attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id UUID REFERENCES employee(emp_id) ON DELETE CASCADE,
  hr_id UUID REFERENCES hr(hr_id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  status VARCHAR(20) CHECK (status IN ('Present','Half-Day','Leave','Absent')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(emp_id, attendance_date)
);

CREATE TABLE time_off(
	request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  	emp_id UUID REFERENCES employee(emp_id) ON DELETE CASCADE,
  	leave_type VARCHAR(20) CHECK (leave_type IN ('Paid','Sick','Unpaid','Half-Day')),
  	start_date DATE,
  	end_date DATE,
	half_day DATE, 
   	status VARCHAR(20) CHECK (status IN ('Pending','Approved','Rejected')) DEFAULT 'Pending',
  	admin_comment TEXT,
  	created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payroll (
  emp_id UUID REFERENCES employee(emp_id) ON DELETE CASCADE,
  paid_date DATE,
  paid_status VARCHAR(20) CHECK (paid_status IN ('Paid','Unpaid')) DEFAULT 'Unpaid'
);

-- ===========================
-- Client onboarding + project intake
-- ===========================

CREATE TABLE IF NOT EXISTS client (
  client_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  company_name VARCHAR(150) NOT NULL,
  profile_picture VARCHAR(255),
  address TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_hr_connections (
  connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES client(client_id) ON DELETE CASCADE,
  hr_id UUID NOT NULL REFERENCES hr(hr_id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'connected', 'declined')),
  last_requested_mode VARCHAR(20) NOT NULL DEFAULT 'connect'
    CHECK (last_requested_mode IN ('connect', 'chat', 'meeting')),
  message TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  UNIQUE (client_id, hr_id)
);

CREATE TABLE IF NOT EXISTS client_project_uploads (
  upload_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES client(client_id) ON DELETE CASCADE,
  hr_id UUID REFERENCES hr(hr_id) ON DELETE SET NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  project_name VARCHAR(255),
  overview TEXT,
  upload_source VARCHAR(20) NOT NULL DEFAULT 'local'
    CHECK (upload_source IN ('local')),
  processing_status VARCHAR(30) NOT NULL DEFAULT 'uploaded'
    CHECK (
      processing_status IN (
        'uploaded',
        'processing',
        'tasks_extracted',
        'tickets_created',
        'assigned',
        'needs_hr_review'
      )
    ),
  confidence_flag VARCHAR(10)
    CHECK (confidence_flag IN ('high', 'low')),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- ===========================
-- Employee enrichment for task assignment
-- ===========================

ALTER TABLE employee
ADD COLUMN IF NOT EXISTS role VARCHAR(120);

ALTER TABLE employee
ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0;

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

-- ===========================
-- Assistant chat history
-- ===========================

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
