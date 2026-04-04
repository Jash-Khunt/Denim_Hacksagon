export type UserRole = "admin" | "employee" | "hr" | "client";

export interface User {
  id?: string;
  hr_id?: string;
  emp_id?: string;
  client_id?: string;
  employeeId?: string;
  email: string;
  role: UserRole;
  name?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  position?: string;
  phone?: string;
  address?: string;
  joinDate?: string;
  profilePicture?: string;
  profile_picture?: string;
  salary?: number;
  companyName?: string;
  company_name?: string;
  companyLogo?: string;
  logo?: string;
  employee_role?: string;
  experience?: number;
  created_at?: string;
  updated_at?: string;
}

export type AttendanceStatus = "present" | "absent" | "half-day" | "leave";

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
  hoursWorked?: number;
}

export interface AttendanceStats {
  present: number;
  absent: number;
  leave: number;
  totalHours: number;
}

export type LeaveType = "paid" | "sick" | "unpaid";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  remarks: string;
  status: LeaveStatus;
  adminComment?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  onLeave: number;
  pendingRequests: number;
}

export interface PayrollRecord {
  id: string;
  userId: string;
  userName: string;
  month: string;
  year: number;
  baseSalary: number;
  deductions: number;
  bonuses: number;
  netSalary: number;
  processedAt: string;
}

export interface Employee {
  id?: string;
  emp_id?: string;
  employeeId?: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  position?: string;
  role?: UserRole;
  employee_role?: string;
  experience?: number;
  salary?: number;
  joinDate?: string;
  profilePicture?: string;
  profile_picture?: string;
  address?: string;
  created_at?: string;
}

export interface HrDirectoryItem {
  hr_id: string;
  name: string;
  email: string;
  phone: string;
  company_name: string;
  logo?: string | null;
  profile_picture?: string | null;
  department?: string | null;
  location?: string | null;
  summary?: string | null;
  skills?: string | null;
  employee_count?: number;
  connection_id?: string | null;
  connection_status?: string | null;
  last_requested_mode?: string | null;
  connection_message?: string | null;
  connection_updated_at?: string | null;
}

export interface ClientConnection {
  connection_id: string;
  status: "pending" | "connected" | "declined";
  last_requested_mode: "connect" | "chat" | "meeting";
  message?: string | null;
  created_at: string;
  updated_at: string;
  hr_id?: string;
  client_id?: string;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  profile_picture?: string | null;
  address?: string | null;
  upload_count?: number;
  task_count?: number;
}

export interface ClientProjectUpload {
  upload_id: string;
  project_name?: string | null;
  overview?: string | null;
  original_name: string;
  file_path: string;
  upload_source?: "local" | "assistant" | string;
  processing_status: string;
  confidence_flag?: string | null;
  bot_raw_response?: string | null;
  created_at: string;
  updated_at: string;
  hr_id?: string | null;
  hr_name?: string | null;
  hr_company_name?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  client_company_name?: string | null;
  task_count?: number;
}

export type TaskStatus = "todo" | "in_progress" | "review" | "done";

export interface ProjectTaskComment {
  comment_id: string;
  task_id: string;
  author_role: UserRole | "system";
  author_name: string;
  content: string;
  created_at: string;
}

export interface ProjectTask {
  task_id: string;
  upload_id?: string | null;
  client_id: string;
  hr_id: string;
  assignee_emp_id?: string | null;
  task_key: string;
  title: string;
  description?: string | null;
  difficulty: "Easy" | "Medium" | "Hard";
  field: string;
  confidence_flag: "High" | "Low";
  human_intervention: boolean;
  status: TaskStatus;
  assignment_mode: "auto" | "manual" | "unassigned";
  priority: "Low" | "Medium" | "High";
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  client_company_name?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string | null;
  project_name?: string | null;
  original_name?: string | null;
  assignee_name?: string | null;
  assignee_role?: string | null;
  comments?: ProjectTaskComment[];
}
