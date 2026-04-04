import React, { createContext, useContext, useState } from 'react';
import { AttendanceRecord, AttendanceStats } from '@/types';
import { attendanceAPI } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface HREmployee {
  emp_id: string;
  name: string;
  email: string;
  phone: string;
  profile_picture: string | null;
  department: string | null;
  attendance_status: string | null;
  check_in: string | null;
  check_out: string | null;
}

interface TodayStatus {
  isCheckedIn: boolean;
  isCheckedOut: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
}

interface AttendanceContextType {
  attendanceRecords: AttendanceRecord[];
  weeklyAttendance: AttendanceRecord[];
  stats: AttendanceStats | null;
  todayStatus: TodayStatus | null;
  isLoading: boolean;
  // Employee actions
  checkIn: () => Promise<boolean>;
  checkOut: () => Promise<boolean>;
  fetchStats: () => Promise<void>;
  fetchWeeklyAttendance: () => Promise<void>;
  fetchDailyAttendance: () => Promise<void>;
  fetchTodayStatus: () => Promise<void>;
  // HR actions
  hrEmployees: HREmployee[];
  hrEmployeeWeekly: AttendanceRecord[];
  hrEmployeeDaily: AttendanceRecord[];
  fetchHREmployeesAttendance: () => Promise<void>;
  fetchHREmployeeWeekly: (empId: string) => Promise<void>;
  fetchHREmployeeDaily: (empId: string) => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [weeklyAttendance, setWeeklyAttendance] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // HR state
  const [hrEmployees, setHREmployees] = useState<HREmployee[]>([]);
  const [hrEmployeeWeekly, setHREmployeeWeekly] = useState<AttendanceRecord[]>([]);
  const [hrEmployeeDaily, setHREmployeeDaily] = useState<AttendanceRecord[]>([]);
  const { toast } = useToast();

  const checkIn = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await attendanceAPI.checkIn();
      
      setAttendanceRecords((prev) => [response.attendance, ...prev]);
      
      toast({
        title: 'Success',
        description: 'Checked in successfully',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to check in',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const checkOut = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await attendanceAPI.checkOut();
      
      setAttendanceRecords((prev) =>
        prev.map((record) =>
          record.id === response.attendance.id ? response.attendance : record
        )
      );
      
      toast({
        title: 'Success',
        description: 'Checked out successfully',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to check out',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await attendanceAPI.getStats();
      setStats(response);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch attendance stats',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWeeklyAttendance = async () => {
    try {
      setIsLoading(true);
      const response = await attendanceAPI.getWeeklyAttendance();
      setWeeklyAttendance(response.attendance);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch weekly attendance',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDailyAttendance = async () => {
    try {
      setIsLoading(true);
      const response = await attendanceAPI.getDailyAttendance();
      setAttendanceRecords(response.attendance);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch daily attendance',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTodayStatus = async () => {
    try {
      const response = await attendanceAPI.getTodayStatus();
      setTodayStatus({
        isCheckedIn: response.isCheckedIn,
        isCheckedOut: response.isCheckedOut,
        checkInTime: response.checkInTime,
        checkOutTime: response.checkOutTime,
      });
    } catch (error: any) {
      // Silently fail for HR users (they don't have this endpoint)
      console.log('Today status not available (may be HR user)');
    }
  };

  // HR functions
  const fetchHREmployeesAttendance = async () => {
    try {
      setIsLoading(true);
      const response = await attendanceAPI.getHREmployeesAttendance();
      setHREmployees(response.employees);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch employees attendance',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHREmployeeWeekly = async (empId: string) => {
    try {
      setIsLoading(true);
      const response = await attendanceAPI.getHREmployeeWeekly(empId);
      setHREmployeeWeekly(response.attendance);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch employee weekly attendance',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHREmployeeDaily = async (empId: string) => {
    try {
      setIsLoading(true);
      const response = await attendanceAPI.getHREmployeeDaily(empId);
      setHREmployeeDaily(response.attendance);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch employee daily attendance',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AttendanceContext.Provider
      value={{
        attendanceRecords,
        weeklyAttendance,
        stats,
        todayStatus,
        isLoading,
        checkIn,
        checkOut,
        fetchStats,
        fetchWeeklyAttendance,
        fetchDailyAttendance,
        fetchTodayStatus,
        hrEmployees,
        hrEmployeeWeekly,
        hrEmployeeDaily,
        fetchHREmployeesAttendance,
        fetchHREmployeeWeekly,
        fetchHREmployeeDaily,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
};
