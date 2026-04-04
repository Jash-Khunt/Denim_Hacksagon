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
          Loading Clautzel...
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
    <div className="relative min-h-screen flex bg-background/80">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-24 right-0 h-80 w-80 rounded-full bg-accent/60 blur-3xl" />
      </div>
      {/* SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar/90 backdrop-blur-sm border-r border-sidebar-border fixed h-full z-10">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 font-bold text-xl text-primary">
            {/* You can put an <img> tag here for user.logo if available */}
            {/* @ts-ignore - backend payload uses company_name */}
            <span>{user?.company_name || "Clautzel"}</span>
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
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-foreground/70 hover:bg-accent hover:text-foreground"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="p-4 border-t border-sidebar-border bg-sidebar/70">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              {/* @ts-ignore - backend payload uses name */}
              {user?.name?.charAt(0)}
            </div>
            <div className="overflow-hidden">
              {/* @ts-ignore - backend payload uses name */}
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
        <div className="lg:hidden p-4 bg-card/90 backdrop-blur-sm border-b border-border/70 flex justify-between items-center sticky top-0 z-20">
          <span className="font-bold">Clautzel</span>
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
