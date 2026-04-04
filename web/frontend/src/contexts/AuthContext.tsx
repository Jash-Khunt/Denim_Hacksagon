import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "@/types";
import { authAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (data: SignupData) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

interface SignupData {
  name: string;
  phone: string;
  email: string;
  password: string;
  company_name: string;
  logo: File;
  profile_picture: File | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Validate user session with backend on mount
  useEffect(() => {
    const validateSession = async () => {
      setIsLoading(true);
      try {
        const response = await authAPI.getCurrentUser();
        setUser(response.user);
        localStorage.setItem("dayflow_user", JSON.stringify(response.user));
      } catch (error) {
        // No valid session
        setUser(null);
        localStorage.removeItem("dayflow_user");
        localStorage.removeItem("dayflow_token");
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await authAPI.login(email, password);

      // Backend sets cookie; store user locally
      setUser(response.user);
      localStorage.setItem("dayflow_user", JSON.stringify(response.user));

      toast({
        title: "Success",
        description: "Logged in successfully",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to login",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: SignupData): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Create FormData for file uploads
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("phone", data.phone);
      formData.append("email", data.email);
      formData.append("password", data.password);
      formData.append("company_name", data.company_name);
      formData.append("logo", data.logo);

      if (data.profile_picture) {
        formData.append("profile_picture", data.profile_picture);
      }

      const response = await authAPI.signup(formData);

      // Backend sets cookie; store user locally
      setUser(response.user);
      localStorage.setItem("dayflow_user", JSON.stringify(response.user));

      toast({
        title: "Success",
        description: "Account created successfully",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      localStorage.removeItem("dayflow_user");
      localStorage.removeItem("dayflow_token");

      toast({
        title: "Success",
        description: "Logged out successfully",
      });
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem("dayflow_user", JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
