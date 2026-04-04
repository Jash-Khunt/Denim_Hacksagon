import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployee } from "@/contexts/EmployeeContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  MoreVertical,
  Mail,
  Phone,
  Building,
  Calendar,
  MapPin,
  Briefcase,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const departmentColors: Record<string, string> = {
  "Human Resources": "bg-purple-100 text-purple-800",
  Engineering: "bg-blue-100 text-blue-800",
  Marketing: "bg-pink-100 text-pink-800",
  Design: "bg-orange-100 text-orange-800",
  Sales: "bg-green-100 text-green-800",
  Finance: "bg-yellow-100 text-yellow-800",
};

const Employees = () => {
  const { user } = useAuth();
  const { employees, isLoading, fetchEmployees, addEmployee: apiAddEmployee } = useEmployee();
  const isHr = user?.role === "hr";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('name-asc');

  // Dialog states
  const [viewProfileOpen, setViewProfileOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);

  // Selected employee for dialogs
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // Add employee form state
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    phone: "",
    password: "12345678",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch employees on mount
  useEffect(() => {
    fetchEmployees();
  }, []);

  // Compute departments from API data
  const departments = [...new Set(employees.map((e: any) => e.department).filter(Boolean))];

  const filteredEmployees = employees.filter((employee: any) => {
    const name = (employee.name || '').toLowerCase();
    const email = (employee.email || '').toLowerCase();
    const empId = (employee.emp_id || employee.employeeId || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = name.includes(query) || email.includes(query) || empId.includes(query);
    const matchesDepartment = !selectedDepartment || employee.department === selectedDepartment;
    return matchesSearch && matchesDepartment;
  }).sort((a: any, b: any) => {
    switch (sortBy) {
      case 'name-desc': return (b.name || '').localeCompare(a.name || '');
      case 'newest': return (b.created_at || '').localeCompare(a.created_at || '');
      case 'oldest': return (a.created_at || '').localeCompare(b.created_at || '');
      default: return (a.name || '').localeCompare(b.name || '');
    }
  });

  const handleViewProfile = (employee: any) => {
    setSelectedEmployee(employee);
    setViewProfileOpen(true);
  };

  const handleAddEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email) {
      toast.error("Name and email are required");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("name", newEmployee.name);
    formData.append("email", newEmployee.email);
    formData.append("phone", newEmployee.phone || "0000000000");
    formData.append("password", newEmployee.password);

    const success = await apiAddEmployee(formData);
    setIsSubmitting(false);

    if (success) {
      setAddEmployeeOpen(false);
      setNewEmployee({ name: "", email: "", phone: "", password: "12345678" });
      fetchEmployees(); // Refresh
    }
  };

  const getInitials = (name: string) => {
    return (name || 'U')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getProfilePicUrl = (path: string | undefined) => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL.replace('/api/v1', '')}/${path}`;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground mt-1">
            Manage your team members ({employees.length} total)
          </p>
        </div>
        {isHr && (
          <Button onClick={() => setAddEmployeeOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="name-asc">Name A → Z</option>
            <option value="name-desc">Name Z → A</option>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted-foreground mr-1">Department:</span>
          <Button
            variant={selectedDepartment === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDepartment(null)}
          >
            All ({employees.length})
          </Button>
          {departments.map((dept) => {
            const count = employees.filter((e: any) => e.department === dept).length;
            return (
              <Button
                key={dept as string}
                variant={selectedDepartment === dept ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDepartment(dept as string)}
              >
                {dept as string} ({count})
              </Button>
            );
          })}
          {(searchQuery || selectedDepartment) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setSelectedDepartment(null); }} className="text-muted-foreground">
              Clear filters
            </Button>
          )}
          <span className="ml-auto text-sm text-muted-foreground">
            Showing {filteredEmployees.length} of {employees.length}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && employees.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading employees...</span>
        </div>
      ) : (
        <>
          {/* Employee Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmployees.map((employee: any) => (
              <Card
                key={employee.emp_id || employee.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleViewProfile(employee)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-14 h-14 border-2 border-background shadow">
                        <AvatarImage src={getProfilePicUrl(employee.profile_picture)} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(employee.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{employee.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {employee.department || "No department"}
                        </p>
                      </div>
                    </div>
                    {isHr && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewProfile(employee)}>
                            View Profile
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {employee.department && (
                    <div className="flex gap-2 flex-wrap mb-4">
                      <Badge
                        className={departmentColors[employee.department] || "bg-gray-100 text-gray-800"}
                        variant="secondary"
                      >
                        {employee.department}
                      </Badge>
                    </div>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{employee.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{employee.phone || "N/A"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredEmployees.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No employees found matching your criteria.
              </p>
            </div>
          )}
        </>
      )}

      {/* View Profile Dialog */}
      <Dialog open={viewProfileOpen} onOpenChange={setViewProfileOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee Profile</DialogTitle>
            <DialogDescription>
              Profile information for {selectedEmployee?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20 border-2 border-background shadow">
                  <AvatarImage src={getProfilePicUrl(selectedEmployee.profile_picture)} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {getInitials(selectedEmployee.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedEmployee.name}</h3>
                  {selectedEmployee.department && (
                    <Badge
                      className={departmentColors[selectedEmployee.department] || "bg-gray-100 text-gray-800"}
                      variant="secondary"
                    >
                      {selectedEmployee.department}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Mail className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedEmployee.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Phone className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedEmployee.phone || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Building className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{selectedEmployee.department || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Briefcase className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Employee ID</p>
                    <p className="font-medium">{selectedEmployee.emp_id?.slice(0, 8) || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Employee Dialog */}
      <Dialog open={addEmployeeOpen} onOpenChange={setAddEmployeeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Fill in the details to add a new team member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="empName">Full Name *</Label>
              <Input
                id="empName"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empEmail">Email *</Label>
              <Input
                id="empEmail"
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                placeholder="john@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empPhone">Phone</Label>
              <Input
                id="empPhone"
                value={newEmployee.phone}
                onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                placeholder="+91 9876543210"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empPassword">Password</Label>
              <Input
                id="empPassword"
                type="password"
                value={newEmployee.password}
                onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                placeholder="Default password"
              />
              <p className="text-xs text-muted-foreground">Default: 12345678 — Employee can change it later</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEmployeeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEmployee} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;
