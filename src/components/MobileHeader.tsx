import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, BarChart3, LogOut, Shield, User, Menu, X, Sun, Moon, Coins, Library, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useTheme } from "@/hooks/useTheme";
import NotificationBell from "@/components/NotificationBell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { cn } from "@/lib/utils";

const MobileHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: "/dashboard", label: "Trilhas", icon: BookOpen },
    { to: "/loja", label: "Loja", icon: Coins },
    { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/base-conhecimento", label: "Base de Conhecimento", icon: Library },
    { to: "/quiz-nexti", label: "Quiz Nexti", icon: Zap },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-lg">
      <div className="flex h-14 items-center justify-between gap-4 px-4">
        <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-nexti">
            <span className="font-display text-sm font-extrabold text-primary-foreground tracking-tight">N</span>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          <NotificationBell />
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 text-foreground">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border/50 bg-card animate-in slide-in-from-top-2">
          <div className="px-4 py-3 space-y-1">
            {links.map(({ to, label, icon: Icon }) => {
              const isActive = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
            <Link
              to="/perfil"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <User className="h-4 w-4" />
              Meu Perfil
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 mt-1 pt-3">
              <button onClick={toggleTheme} className="flex items-center gap-2 text-sm text-muted-foreground">
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {theme === "light" ? "Modo escuro" : "Modo claro"}
              </button>
              <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-destructive">
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default MobileHeader;
