import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useResearchPermissions } from "@/hooks/useResearchPermissions";

const ResearchRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const perms = useResearchPermissions();
  if (loading || perms.loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!perms.hasAny) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};
export default ResearchRoute;
