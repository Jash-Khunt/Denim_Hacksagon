import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  Briefcase, 
  Calendar,
  IndianRupee,
  Edit2,
  Save,
  FileText,
  Upload,
  Wallet,
  Loader2,
} from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  const { isLoading, fetchProfile, updateProfile, uploadProfileImage } = useProfile();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [formData, setFormData] = useState({
    phone: '',
    address: '',
  });

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (user) {
        const id =
          (user as any).emp_id ||
          (user as any).client_id ||
          (user as any).hr_id ||
          user.id;
        if (id) {
          const profile = await fetchProfile(id);
          if (profile) {
            setProfileData(profile);
            setFormData({
              phone: (profile as any).phone || user.phone || '',
              address: (profile as any).address || user.address || '',
            });
          }
        }
      }
    };
    loadProfile();
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    const success = await updateProfile({
      phone: formData.phone,
      address: formData.address,
    });
    setIsSaving(false);
    if (success) {
      setIsEditing(false);
      // Refresh profile
      const id =
        (user as any)?.emp_id ||
        (user as any)?.client_id ||
        (user as any)?.hr_id ||
        user?.id;
      if (id) {
        const profile = await fetchProfile(id);
        if (profile) setProfileData(profile);
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadProfileImage(file);
    }
  };

  // Combine user and profile data
  const displayName = profileData?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || (user as any)?.name || 'User';
  const displayEmail = profileData?.email || user?.email || '';
  const displayPhone = profileData?.phone || user?.phone || '';
  const displayAddress = profileData?.address || user?.address || '';
  const displayDepartment =
    profileData?.department || user?.department || profileData?.company_name || '';
  const displayPosition =
    profileData?.employee_role ||
    profileData?.position ||
    (user as any)?.employee_role ||
    (user as any)?.position ||
    '';
  const displayRole = (user as any)?.role || '';
  const displaySalary = profileData?.salary || user?.salary || 0;
  const displayJoinDate = profileData?.date_of_joining || user?.joinDate || '';
  const displayProfilePic = profileData?.profile_picture || user?.profilePicture || '';
  const displayEmpCode = profileData?.emp_code || user?.employeeId || '';

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex items-start gap-4 py-4 border-b border-border/50 last:border-0">
      <div className="p-2 rounded-lg bg-muted">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium mt-0.5">{value || 'Not specified'}</p>
      </div>
    </div>
  );

  // Salary Calculation Logic
  const calculateSalaryComponents = (annualSalary = 0) => {
    const monthlyWage = annualSalary / 12;
    const basic = monthlyWage * 0.50; 
    const hra = basic * 0.50;
    const stdAllowance = 4167;
    const bonus = basic * 0.0833;
    const lta = basic * 0.0833;
    const fixedAllowance = monthlyWage - (basic + hra + stdAllowance + bonus + lta);
    const pfEmployee = basic * 0.12;
    const profTax = 200;
    const totalDeductions = pfEmployee + profTax;
    const netSalary = monthlyWage - totalDeductions;
    const pfEmployer = basic * 0.12;

    return {
      monthlyWage, basic, hra, stdAllowance, bonus, lta, fixedAllowance,
      pfEmployee, profTax, totalDeductions, netSalary, pfEmployer
    };
  };

  const salaryData = calculateSalaryComponents(displaySalary || 600000);

  const firstInitial = displayName.split(' ')[0]?.[0] || '';
  const lastInitial = displayName.split(' ')[1]?.[0] || '';

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Profile Header Card */}
      <Card>
        <CardContent className="p-4 md:p-8">
          <div className="flex flex-row items-start gap-4 md:gap-8">
            <div className="relative flex-shrink-0">
              <Avatar className="w-[120px] h-[120px] md:w-32 md:h-32 border-4 border-background shadow-lg">
                <AvatarImage src={displayProfilePic} />
                <AvatarFallback className="text-2xl md:text-3xl bg-primary text-primary-foreground">
                  {firstInitial}{lastInitial}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <label className="absolute -bottom-2 -right-2 cursor-pointer">
                  <Button size="sm" className="rounded-full w-10 h-10 p-0" asChild>
                    <span>
                      <Upload className="w-4 h-4" />
                    </span>
                  </Button>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </label>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                <h2 className="text-lg md:text-2xl font-bold truncate">
                  {displayName}
                </h2>
                <Badge variant="secondary" className="capitalize text-xs">
                  {displayRole}
                </Badge>
              </div>
              <p className="text-sm md:text-base text-muted-foreground">{displayPosition}</p>
              <p className="text-sm md:text-base text-muted-foreground">{displayDepartment}</p>
              <div className="flex flex-row flex-wrap gap-2 md:gap-4 mt-3 md:mt-4">
                <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground min-w-0">
                  <Mail className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                  <span className="break-all">{displayEmail}</span>
                </div>
                <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground whitespace-nowrap">
                  <Briefcase className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                  {displayEmpCode || 'N/A'}
                </div>
              </div>
            </div>
              <Button onClick={() => isEditing ? handleSave() : setIsEditing(true)} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : isEditing ? (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          ) : (
            <>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Profile
            </>
          )}
        </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Tabs */}
      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="w-auto justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="personal" className="whitespace-nowrap">Personal Details</TabsTrigger>
          <TabsTrigger value="job" className="whitespace-nowrap">Job Details</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Your personal contact information</CardDescription>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={displayName} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={displayEmail} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Enter address"
                    />
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  <InfoRow icon={User} label="Full Name" value={displayName} />
                  <InfoRow icon={Mail} label="Email Address" value={displayEmail} />
                  <InfoRow icon={Phone} label="Phone Number" value={displayPhone} />
                  <InfoRow icon={MapPin} label="Address" value={displayAddress} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="job">
          <Card>
            <CardHeader>
              <CardTitle>Job Information</CardTitle>
              <CardDescription>Your employment details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border/50">
                <InfoRow icon={Briefcase} label="Employee Code" value={displayEmpCode} />
                <InfoRow icon={Building} label="Department" value={displayDepartment} />
                <InfoRow icon={Briefcase} label="Position" value={displayPosition} />
                <InfoRow icon={Calendar} label="Join Date" value={displayJoinDate ? new Date(displayJoinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not specified'} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;
