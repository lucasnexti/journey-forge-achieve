import { useState } from "react";
import AdminSidebar from "./AdminSidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}

const AdminLayout = ({ children, rightPanel }: AdminLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-secondary/50">
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <div
        className={`transition-all duration-300 ${collapsed ? "ml-16" : "ml-60"}`}
      >
        <div className="flex min-h-screen">
          <main className={`flex-1 p-6 ${rightPanel ? "max-w-[calc(100%-320px)]" : ""}`}>
            {children}
          </main>

          {rightPanel && (
            <aside className="w-80 shrink-0 border-l border-border/50 bg-card p-6">
              {rightPanel}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
