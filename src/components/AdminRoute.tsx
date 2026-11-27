import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import MasterMfaGate from "@/components/auth/MasterMfaGate";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/** Páginas que o admin de um ambiente (cliente) pode abrir. */
export const COMPANY_ADMIN_PATHS = ["/admin/trilhas-gestao", "/admin/colaboradores", "/relatorios", "/treinamento-presencial"];

const AdminRoute = ({ children, masterOnly = false }: { children: React.ReactNode; masterOnly?: boolean }) => {
  const { user, loading: authLoading } = useAuth();
  const { canAccessAdmin, isAdmin, isMaster, loading: adminLoading } = useIsAdmin();
  const location = useLocation();

  if (authLoading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!canAccessAdmin) return <Navigate to="/dashboard" replace />;
  if (masterOnly && !isMaster) return <Navigate to="/admin" replace />;
  if (!isAdmin && !isMaster && !COMPANY_ADMIN_PATHS.includes(location.pathname)) {
    return <Navigate to="/admin/trilhas-gestao" replace />;
  }

  return <MasterMfaGate>{children}</MasterMfaGate>;
};

export default AdminRoute;
