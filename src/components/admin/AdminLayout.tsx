import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminAppSidebar } from "./AdminAppSidebar";
import NotificationBell from "@/components/NotificationBell";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileHeader from "@/components/MobileHeader";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen min-h-dvh bg-background">
        <MobileHeader />
        <main className="px-4 py-5 sm:px-6 overflow-x-hidden">{children}</main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen min-h-dvh flex w-full">
        <AdminAppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-border/50 bg-card/80 backdrop-blur-lg px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <NotificationBell />
          </header>
          <main className="flex-1 min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto w-full max-w-[1600px]">{children}</div></main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
