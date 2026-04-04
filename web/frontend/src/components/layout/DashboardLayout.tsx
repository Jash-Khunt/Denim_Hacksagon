import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Outlet, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Clock,
  DollarSign,
  Settings,
  LogOut,
  UserCircle,
  FileText,
  Handshake,
  KanbanSquare,
} from "lucide-react";

const ASSISTANT_FULLSCREEN_EVENT = "assistant-fullscreen-change";

const DashboardLayout = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [isAssistantFullscreen, setIsAssistantFullscreen] = useState(
    () => document.body.dataset.assistantFullscreen === "true",
  );

  useEffect(() => {
    const handleAssistantFullscreenChange = (event: Event) => {
      const detail = (
        event as CustomEvent<{ isFullscreen?: boolean }>
      ).detail;
      setIsAssistantFullscreen(Boolean(detail?.isFullscreen));
    };

    window.addEventListener(
      ASSISTANT_FULLSCREEN_EVENT,
      handleAssistantFullscreenChange,
    );
    setIsAssistantFullscreen(
      document.body.dataset.assistantFullscreen === "true",
    );

    return () => {
      window.removeEventListener(
        ASSISTANT_FULLSCREEN_EVENT,
        handleAssistantFullscreenChange,
      );
    };
  }, []);

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
      roles: ["hr", "employee", "client"],
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
      label: "Project Uploads",
      href: "/client/projects",
      icon: FileText,
      roles: ["client"],
    },
    {
      label: "Client Requests",
      href: "/hr/connections",
      icon: Handshake,
      roles: ["hr"],
    },
    {
      label: "HR Directory",
      href: "/client/hr-directory",
      icon: Handshake,
      roles: ["client"],
    },
    {
      label: "Tickets",
      href: "/tickets",
      icon: KanbanSquare,
      roles: ["hr", "employee"],
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
      roles: ["hr", "employee", "client"],
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
    (item) => user && item.roles.includes(user.role),
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
      <aside
        className={cn(
          "fixed z-10 hidden h-full w-64 flex-col border-r border-sidebar-border bg-sidebar/90 backdrop-blur-sm transition-transform duration-500 ease-out lg:flex",
          isAssistantFullscreen
            ? "pointer-events-none -translate-x-full"
            : "translate-x-0",
        )}
      >
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 font-bold text-xl text-primary">
            {/* You can put an <img> tag here for user.logo if available */}
            <span>{user?.company_name || user?.companyName || "Clautzel"}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 px-1">
            {user?.role === "hr"
              ? "Administrator"
              : user?.role === "client"
                ? "Client Workspace"
                : "Employee Portal"}
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
              {(user?.name || user?.firstName || "U").charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">
                {user?.name ||
                  `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
                  "User"}
              </p>
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
      <main
        className={cn(
          "min-h-screen flex-1 transition-all duration-500 ease-out",
          isAssistantFullscreen ? "lg:ml-0" : "lg:ml-64",
        )}
      >
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
