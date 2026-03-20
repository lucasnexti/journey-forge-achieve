import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import NotificationBell from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileHeader from "@/components/MobileHeader";

interface AppLayoutProps {
  children: React.ReactNode;
  /** Hide sidebar entirely (e.g. TrackPage cinema mode) */
  fullWidth?: boolean;
}

const AppLayout = ({ children, fullWidth = false }: AppLayoutProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen min-h-dvh bg-background">
        <MobileHeader />
        {children}
      </div>
    );
  }

  if (fullWidth) {
    return (
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen min-h-dvh flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-border/50 bg-card/80 backdrop-blur-lg px-4">
              <SidebarTrigger />
              <div className="flex-1 max-w-md">
                <GlobalSearch />
              </div>
              <div className="flex-1" />
              <NotificationBell />
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen min-h-dvh flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-border/50 bg-card/80 backdrop-blur-lg px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <NotificationBell />
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
