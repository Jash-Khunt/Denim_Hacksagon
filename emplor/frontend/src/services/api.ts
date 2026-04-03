import { User, AttendanceRecord, LeaveRequest, LeaveType } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'An error occurred');
  }
  return response.json();
}

// ==================== AUTH API ====================
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<{ user: User }>(response);
  },

  signup: async (data: FormData) => {
    const response = await fetch(`${API_BASE_URL}/auth/users/signup`, {
      method: 'POST',
      credentials: 'include',
      body: data,
    });
    return handleResponse<{ user: User }>(response);
  },

  logout: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/users/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  getCurrentUser: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/users/me`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(response);
  },
};

// ==================== EMPLOYEE API ====================
export const employeeAPI = {
  addEmployee: async (data: FormData) => {
    const response = await fetch(`${API_BASE_URL}/hr/add`, {
      method: 'POST',
      credentials: 'include',
      body: data,
    });
    return handleResponse<{ employee: User }>(response);
  },

  getAllEmployees: async () => {
    const response = await fetch(`${API_BASE_URL}/hr/all`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ employees: User[] }>(response);
  },
};

// ==================== PROFILE API ====================
export const profileAPI = {
  getProfile: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/up/${id}`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(response);
  },

  updateProfile: async (data: any) => {
    const response = await fetch(`${API_BASE_URL}/up/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<{ user: User }>(response);
  },

  uploadImage: async (data: FormData) => {
    const response = await fetch(`${API_BASE_URL}/up/upload-image`, {
      method: 'POST',
      credentials: 'include',
      body: data,
    });
    return handleResponse<{ imageUrl: string }>(response);
  },
};

// ==================== ATTENDANCE API ====================
export const attendanceAPI = {
  checkIn: async () => {
    const response = await fetch(`${API_BASE_URL}/attendance/check-in`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ attendance: AttendanceRecord }>(response);
  },

  checkOut: async () => {
    const response = await fetch(`${API_BASE_URL}/attendance/check-out`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ attendance: AttendanceRecord }>(response);
  },

  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/attendance/stats`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{
      present: number;
      absent: number;
      leave: number;
      totalHours: number;
    }>(response);
  },

  getWeeklyAttendance: async () => {
    const response = await fetch(`${API_BASE_URL}/attendance/weekly`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ attendance: AttendanceRecord[] }>(response);
  },

  getDailyAttendance: async () => {
    const response = await fetch(`${API_BASE_URL}/attendance/daily`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ attendance: AttendanceRecord[] }>(response);
  },

  getTodayStatus: async () => {
    const response = await fetch(`${API_BASE_URL}/attendance/today`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ 
      isCheckedIn: boolean; 
      isCheckedOut: boolean;
      checkInTime: string | null; 
      checkOutTime: string | null;
      record: any;
    }>(response);
  },

  // HR endpoints
  getHREmployeesAttendance: async () => {
    const response = await fetch(`${API_BASE_URL}/attendance/hr/employees`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ employees: any[] }>(response);
  },

  getHREmployeeWeekly: async (empId: string) => {
    const response = await fetch(`${API_BASE_URL}/attendance/hr/employee/${empId}/weekly`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ attendance: AttendanceRecord[] }>(response);
  },

  getHREmployeeDaily: async (empId: string) => {
    const response = await fetch(`${API_BASE_URL}/attendance/hr/employee/${empId}/daily`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ attendance: AttendanceRecord[] }>(response);
  },
};

// ==================== LEAVE API ====================
export const leaveAPI = {
  createRequest: async (data: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    remarks: string;
  }) => {
    // Map frontend field names to backend expected names
    const payload = {
      type: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      remarks: data.remarks,
    };
    const response = await fetch(`${API_BASE_URL}/leave/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ leave: LeaveRequest }>(response);
  },

  getMyLeaves: async () => {
    const response = await fetch(`${API_BASE_URL}/leave/my-leaves`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ leaves: LeaveRequest[] }>(response);
  },

  getAllLeaves: async () => {
    const response = await fetch(`${API_BASE_URL}/leave/all`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ leaves: LeaveRequest[] }>(response);
  },

  approveLeave: async (id: string, comment?: string) => {
    const response = await fetch(`${API_BASE_URL}/leave/approve/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ comment }),
    });
    return handleResponse<{ leave: LeaveRequest }>(response);
  },

  rejectLeave: async (id: string, comment?: string) => {
    const response = await fetch(`${API_BASE_URL}/leave/reject/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ comment }),
    });
    return handleResponse<{ leave: LeaveRequest }>(response);
  },
};

// ==================== PAYROLL API ====================
export const payrollAPI = {
  getMyPayroll: async () => {
    const response = await fetch(`${API_BASE_URL}/payroll/my-payroll`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ payroll: any[]; currentSalary: number }>(response);
  },

  getAllPayroll: async () => {
    const response = await fetch(`${API_BASE_URL}/payroll/all`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ payroll: any[] }>(response);
  },

  getPayrollSummary: async () => {
    const response = await fetch(`${API_BASE_URL}/payroll/summary`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ employees: any[]; summary: any }>(response);
  },

  updateSalary: async (id: string, salary: number) => {
    const response = await fetch(`${API_BASE_URL}/payroll/update-salary/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ salary }),
    });
    return handleResponse<{ message: string }>(response);
  },

  processPayroll: async (data: { month: string; year: number }) => {
    const response = await fetch(`${API_BASE_URL}/payroll/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<{ message: string }>(response);
  },

  payIndividual: async (data: { empId: string; amount: number; month: number; year: number; note?: string }) => {
    const response = await fetch(`${API_BASE_URL}/payroll/pay-individual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<{ message: string }>(response);
  },
};

export default {
  auth: authAPI,
  employee: employeeAPI,
  profile: profileAPI,
  attendance: attendanceAPI,
  leave: leaveAPI,
  payroll: payrollAPI,
};
