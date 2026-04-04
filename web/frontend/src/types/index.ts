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

export interface ClientProjectUpload {
  upload_id: string;
  project_name?: string | null;
  overview?: string | null;
  original_name: string;
  file_path: string;
  processing_status: string;
  confidence_flag?: string | null;
  created_at: string;
  updated_at: string;
  hr_id?: string | null;
  hr_name?: string | null;
  hr_company_name?: string | null;
}
