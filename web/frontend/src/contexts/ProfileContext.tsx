import React, { createContext, useContext, useState } from 'react';
import { User } from '@/types';
import { profileAPI } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthContext';

interface ProfileContextType {
  isLoading: boolean;
  fetchProfile: (id: string) => Promise<User | null>;
  updateProfile: (data: UpdateProfileData) => Promise<boolean>;
  uploadProfileImage: (file: File) => Promise<boolean>;
}

interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  department?: string;
  position?: string;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { updateUser, user } = useAuth();

  const fetchProfile = async (id: string): Promise<User | null> => {
    try {
      setIsLoading(true);
      const response = await profileAPI.getProfile(id);
      return response.user;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch profile',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: UpdateProfileData): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await profileAPI.updateProfile(data);
      
      // Update the auth context with new user data
      updateUser(response.user);
      
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const uploadProfileImage = async (file: File): Promise<boolean> => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('profile_picture', file);
      
      const response = await profileAPI.uploadImage(formData);
      
      // Update the user with new profile picture
      if (user) {
        updateUser({ ...user, profilePicture: response.imageUrl });
      }
      
      toast({
        title: 'Success',
        description: 'Profile image updated successfully',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload image',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        isLoading,
        fetchProfile,
        updateProfile,
        uploadProfileImage,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
