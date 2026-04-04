import React, { createContext, useContext, useState } from 'react';
import { Employee } from '@/types';
import { employeeAPI } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface EmployeeContextType {
  employees: Employee[];
  isLoading: boolean;
  fetchEmployees: () => Promise<void>;
  addEmployee: (data: FormData) => Promise<boolean>;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const response = await employeeAPI.getAllEmployees();
      setEmployees(response.employees);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch employees',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addEmployee = async (data: FormData): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await employeeAPI.addEmployee(data);
      
      setEmployees((prev) => [...prev, response.employee]);
      
      toast({
        title: 'Success',
        description: 'Employee added successfully',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add employee',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <EmployeeContext.Provider value={{ employees, isLoading, fetchEmployees, addEmployee }}>
      {children}
    </EmployeeContext.Provider>
  );
};

export const useEmployee = () => {
  const context = useContext(EmployeeContext);
  if (!context) {
    throw new Error('useEmployee must be used within an EmployeeProvider');
  }
  return context;
};
