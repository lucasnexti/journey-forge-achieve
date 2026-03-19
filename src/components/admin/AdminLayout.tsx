import { useState, useEffect } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminTopBar from "./AdminTopBar";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}

const AdminLayout = ({ children, rightPanel }: AdminLayoutProps) => {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("admin-sidebar-collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("admin-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-secondary/50">
      <AdminSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          "transition-all duration-300",
          collapsed ? "lg:ml-16" : "lg:ml-60"
        )}
      >
        <AdminTopBar
          onMenuClick={() => setMobileOpen(true)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />

        <div className="flex min-h-[calc(100vh-3.5rem)]">
          <main className={cn("flex-1 p-4 sm:p-6", rightPanel && "max-w-[calc(100%-320px)]")}>
            {children}
          </main>

          {rightPanel && (
            <aside className="hidden lg:block w-80 shrink-0 border-l border-border/50 bg-card p-6">
              {rightPanel}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
