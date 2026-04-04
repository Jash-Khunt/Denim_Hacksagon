import React, { createContext, useContext, useState } from 'react';
import { PayrollRecord } from '@/types';
import { payrollAPI } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface PayrollContextType {
  payrollRecords: PayrollRecord[];
  myPayroll: PayrollRecord[];
  payrollSummary: any | null;
  currentSalary: number;
  isLoading: boolean;
  fetchMyPayroll: () => Promise<void>;
  fetchAllPayroll: () => Promise<void>;
  fetchPayrollSummary: () => Promise<void>;
  updateSalary: (id: string, salary: number) => Promise<boolean>;
  processPayroll: (data: ProcessPayrollData) => Promise<boolean>;
}

interface ProcessPayrollData {
  month: string;
  year: number;
}

const PayrollContext = createContext<PayrollContextType | undefined>(undefined);

export const PayrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [myPayroll, setMyPayroll] = useState<PayrollRecord[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<any | null>(null);
  const [currentSalary, setCurrentSalary] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchMyPayroll = async () => {
    try {
      setIsLoading(true);
      const response = await payrollAPI.getMyPayroll();
      setMyPayroll(response.payroll);
      setCurrentSalary(response.currentSalary || 0);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch payroll records',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllPayroll = async () => {
    try {
      setIsLoading(true);
      const response = await payrollAPI.getAllPayroll();
      setPayrollRecords(response.payroll);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch payroll records',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPayrollSummary = async () => {
    try {
      setIsLoading(true);
      const response = await payrollAPI.getPayrollSummary();
      setPayrollSummary(response);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch payroll summary',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSalary = async (id: string, salary: number): Promise<boolean> => {
    try {
      setIsLoading(true);
      await payrollAPI.updateSalary(id, salary);
      
      toast({
        title: 'Success',
        description: 'Salary updated successfully',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update salary',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const processPayroll = async (data: ProcessPayrollData): Promise<boolean> => {
    try {
      setIsLoading(true);
      await payrollAPI.processPayroll(data);
      
      toast({
        title: 'Success',
        description: 'Payroll processed successfully',
      });
      
      // Refresh data
      await fetchPayrollSummary();
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process payroll',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PayrollContext.Provider
      value={{
        payrollRecords,
        myPayroll,
        payrollSummary,
        currentSalary,
        isLoading,
        fetchMyPayroll,
        fetchAllPayroll,
        fetchPayrollSummary,
        updateSalary,
        processPayroll,
      }}
    >
      {children}
    </PayrollContext.Provider>
  );
};

export const usePayroll = () => {
  const context = useContext(PayrollContext);
  if (!context) {
    throw new Error('usePayroll must be used within a PayrollProvider');
  }
  return context;
};
