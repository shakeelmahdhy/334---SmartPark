import { Outlet, Link, useLocation, Navigate } from "react-router";
import { LayoutDashboard, Calendar, TrendingUp, Settings, LogOut } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const userNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/booking", label: "My Bookings", icon: Calendar },
  { path: "/predictions", label: "Predictions", icon: TrendingUp },
];

const adminNavItems = [
  { path: "/admin", label: "Admin Panel", icon: Settings },
];

const userRoutes = ["/dashboard", "/booking", "/predictions"];
const adminRoutes = ["/admin"];

export function Layout() {
  const location = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const isLoginPage = location.pathname === "/";

  if (loading) {
    return null;
  }

  if (isLoginPage) {
    if (isAuthenticated) {
      return <Navigate to={user?.is_admin ? "/admin" : "/dashboard"} replace />;
    }
    return <Outlet />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const isAdmin = user?.is_admin ?? false;

  if (isAdmin && userRoutes.includes(location.pathname)) {
    return <Navigate to="/admin" replace />;
  }
  if (!isAdmin && adminRoutes.includes(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <div className="flex h-screen bg-[#0b1120]">
      {/* Sidebar */}
      <div className="w-60 bg-[#0b1120] border-r border-[#1e2d45] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-[#1e2d45]">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-6 h-6 bg-amber-500 flex items-center justify-center">
              <span className="text-[10px] font-bold text-slate-900 font-mono">SP</span>
            </div>
            <span className="text-slate-100 font-semibold tracking-wide text-sm uppercase">SmartPark</span>
          </div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest pl-8">
            {isAdmin ? "Administrator" : "Management System"}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4">
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest px-2 mb-3">
            Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 mb-1 transition-colors text-sm relative ${
                  isActive
                    ? "text-amber-400 bg-amber-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-500" />
                )}
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-[#1e2d45]">
          <Link
            to="/"
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
