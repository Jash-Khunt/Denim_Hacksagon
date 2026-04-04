import React from 'react';
import { AuthProvider } from './AuthContext';
import { EmployeeProvider } from './EmployeeContext';
import { AttendanceProvider } from './AttendanceContext';
import { LeaveProvider } from './LeaveContext';
import { PayrollProvider } from './PayrollContext';
import { ProfileProvider } from './ProfileContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * AppProviders wraps all context providers in the correct order
 * AuthProvider must be the outermost provider as other contexts may depend on it
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <AuthProvider>
      <ProfileProvider>
        <EmployeeProvider>
          <AttendanceProvider>
            <LeaveProvider>
              <PayrollProvider>
                {children}
              </PayrollProvider>
            </LeaveProvider>
          </AttendanceProvider>
        </EmployeeProvider>
      </ProfileProvider>
    </AuthProvider>
  );
};

// Export all hooks for convenience
export { useAuth } from './AuthContext';
export { useEmployee } from './EmployeeContext';
export { useAttendance } from './AttendanceContext';
export { useLeave } from './LeaveContext';
export { usePayroll } from './PayrollContext';
export { useProfile } from './ProfileContext';
