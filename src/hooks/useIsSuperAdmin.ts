import { useAuth } from "@/contexts/AuthContext";

const SUPER_ADMIN_EMAIL = "robson@nexti.com";

export const useIsSuperAdmin = () => {
  const { user, loading } = useAuth();
  return {
    isSuperAdmin: !loading && !!user && user.email === SUPER_ADMIN_EMAIL,
    loading,
  };
};
