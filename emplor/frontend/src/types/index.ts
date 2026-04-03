export type UserRole = 'admin' | 'employee' | 'hr';

export interface User {
  id: string;
  employeeId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  department: string;
  position: string;
  phone: string;
  address: string;
  joinDate: string;
  profilePicture?: string;
  salary: number;
  companyName?: string;
  companyLogo?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'half-day' | 'leave';

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

export type LeaveType = 'paid' | 'sick' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

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
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  role: UserRole;
  salary: number;
  joinDate: string;
  profilePicture?: string;
  address?: string;
}

