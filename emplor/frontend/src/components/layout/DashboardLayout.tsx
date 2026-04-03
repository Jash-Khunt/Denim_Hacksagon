import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Outlet, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  DollarSign,
  Settings,
  LogOut,
  UserCircle,
  CheckSquare,
} from "lucide-react";

const DashboardLayout = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  // 1. Handle Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground animate-pulse">
          Loading DayFlow...
        </div>
      </div>
    );
  }

  // 2. Handle Unauthenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // 3. Define Navigation Items
  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["hr", "employee"],
    },
    {
      label: "Attendance & Leave",
      href: "/attendance",
      icon: Clock,
      roles: ["hr", "employee"],
    },
    {
      label: "Employees",
      href: "/employees",
      icon: Users,
      roles: ["hr"], // HR Only
    },
    {
      label: "Payroll",
      href: "/payroll",
      icon: DollarSign,
      roles: ["hr", "employee"],
    },
    {
      label: "Profile",
      href: "/profile",
      icon: UserCircle,
      roles: ["hr", "employee"],
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      roles: ["hr"], // HR Only
    },
  ];

  // 4. Filter items based on Role
  const filteredNavItems = navItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r fixed h-full z-10">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2 font-bold text-xl text-primary">
            {/* You can put an <img> tag here for user.logo if available */}
            <span>{user?.company_name || "DayFlow"}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 px-1">
            {user?.role === "hr" ? "Administrator" : "Employee Portal"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              {user?.name?.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 lg:ml-64 min-h-screen transition-all duration-300">
        {/* Mobile Header (optional, simplified) */}
        <div className="lg:hidden p-4 bg-white border-b flex justify-between items-center sticky top-0 z-20">
          <span className="font-bold">DayFlow</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
