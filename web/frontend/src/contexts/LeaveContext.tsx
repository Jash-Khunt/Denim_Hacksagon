import React, { createContext, useContext, useState } from 'react';
import { LeaveRequest, LeaveType } from '@/types';
import { leaveAPI } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface LeaveContextType {
  leaves: LeaveRequest[];
  myLeaves: LeaveRequest[];
  isLoading: boolean;
  createLeaveRequest: (data: CreateLeaveData) => Promise<boolean>;
  fetchMyLeaves: () => Promise<void>;
  fetchAllLeaves: () => Promise<void>;
  approveLeave: (id: string, comment?: string) => Promise<boolean>;
  rejectLeave: (id: string, comment?: string) => Promise<boolean>;
}

interface CreateLeaveData {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  remarks: string;
}

const LeaveContext = createContext<LeaveContextType | undefined>(undefined);

export const LeaveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const createLeaveRequest = async (data: CreateLeaveData): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await leaveAPI.createRequest(data);
      
      setMyLeaves((prev) => [response.leave, ...prev]);
      
      toast({
        title: 'Success',
        description: 'Leave request submitted successfully',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit leave request',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyLeaves = async () => {
    try {
      setIsLoading(true);
      const response = await leaveAPI.getMyLeaves();
      setMyLeaves(response.leaves);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch leave requests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllLeaves = async () => {
    try {
      setIsLoading(true);
      const response = await leaveAPI.getAllLeaves();
      setLeaves(response.leaves);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch leave requests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const approveLeave = async (id: string, comment?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await leaveAPI.approveLeave(id, comment);
      
      setLeaves((prev) =>
        prev.map((leave) => (leave.id === id ? response.leave : leave))
      );
      
      toast({
        title: 'Success',
        description: 'Leave request approved',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve leave request',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const rejectLeave = async (id: string, comment?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await leaveAPI.rejectLeave(id, comment);
      
      setLeaves((prev) =>
        prev.map((leave) => (leave.id === id ? response.leave : leave))
      );
      
      toast({
        title: 'Success',
        description: 'Leave request rejected',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject leave request',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LeaveContext.Provider
      value={{
        leaves,
        myLeaves,
        isLoading,
        createLeaveRequest,
        fetchMyLeaves,
        fetchAllLeaves,
        approveLeave,
        rejectLeave,
      }}
    >
      {children}
    </LeaveContext.Provider>
  );
};

export const useLeave = () => {
  const context = useContext(LeaveContext);
  if (!context) {
    throw new Error('useLeave must be used within a LeaveProvider');
  }
  return context;
};
