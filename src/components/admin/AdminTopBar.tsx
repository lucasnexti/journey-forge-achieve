import { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Menu, Search, Bell, GraduationCap, ChevronRight, LogOut, User, X
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Breadcrumb map
const routeLabels: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/cursos-ead": "Cursos EAD",
  "/admin/trilhas-gestao": "Trilhas",
  "/admin/quizzes": "Quizzes",
  "/admin/treinamentos": "Treinamentos",
  "/admin/usuarios": "Usuários",
  "/admin/matriculas": "Matrículas",
  "/admin/certificados": "Certificados",
  "/admin/gamificacao": "Gamificação",
  "/admin/forum-gestao": "Fórum / Mural",
  "/admin/notificacoes": "Notificações",
  "/admin/avaliacoes": "Avaliações",
  "/admin/personalizacao": "Personalização",
  "/admin/relatorio-progresso": "Relatórios",
  "/admin/logs": "Logs",
};

const routeGroups: Record<string, string> = {
  "/admin/cursos-ead": "Conteúdo",
  "/admin/trilhas-gestao": "Conteúdo",
  "/admin/quizzes": "Conteúdo",
  "/admin/treinamentos": "Conteúdo",
  "/admin/usuarios": "Pessoas",
  "/admin/matriculas": "Pessoas",
  "/admin/certificados": "Pessoas",
  "/admin/gamificacao": "Engajamento",
  "/admin/forum-gestao": "Engajamento",
  "/admin/notificacoes": "Engajamento",
  "/admin/avaliacoes": "Engajamento",
  "/admin/personalizacao": "Configuração",
  "/admin/relatorio-progresso": "Configuração",
  "/admin/logs": "Configuração",
};

// Search items for global search
const searchItems = Object.entries(routeLabels).map(([to, label]) => ({ to, label }));

interface AdminTopBarProps {
  onMenuClick: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const AdminTopBar = ({ onMenuClick, collapsed, onToggleCollapse }: AdminTopBarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const currentLabel = routeLabels[location.pathname] || "Admin";
  const currentGroup = routeGroups[location.pathname];

  const filteredSearch = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchItems.filter((item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleSearchSelect = (to: string) => {
    navigate(to);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "AD";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-card/80 backdrop-blur-md px-4">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden shrink-0"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Desktop collapse toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:flex shrink-0"
        onClick={onToggleCollapse}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Breadcrumb */}
      <nav className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/admin" className="hover:text-foreground transition-colors">Admin</Link>
        {currentGroup && (
          <>
            <ChevronRight className="h-3 w-3" />
            <span>{currentGroup}</span>
          </>
        )}
        {currentLabel !== "Dashboard" && (
          <>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground">{currentLabel}</span>
          </>
        )}
      </nav>

      {/* Mobile page title */}
      <span className="sm:hidden text-sm font-semibold text-foreground truncate">
        {currentLabel}
      </span>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative">
        {searchOpen ? (
          <div className="flex items-center">
            <div className="relative">
              <Input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar menu..."
                className="h-8 w-48 sm:w-64 pr-8 text-sm"
                onBlur={() => setTimeout(() => { setSearchOpen(false); setSearchQuery(""); }, 200)}
              />
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {filteredSearch.length > 0 && (
              <div className="absolute right-0 top-full mt-1 w-48 sm:w-64 rounded-lg border border-border bg-popover p-1 shadow-lg">
                {filteredSearch.map((item) => (
                  <button
                    key={item.to}
                    onMouseDown={() => handleSearchSelect(item.to)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent/10 transition-colors text-left"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSearchOpen(true)}>
            <Search className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Student mode */}
      <Button
        variant="outline"
        size="sm"
        className="hidden sm:flex items-center gap-1.5 h-8 text-xs"
        onClick={() => navigate("/dashboard")}
      >
        <GraduationCap className="h-3.5 w-3.5" />
        Modo Aluno
      </Button>

      {/* Notifications */}
      <Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={() => navigate("/admin/notificacoes")}>
        <Bell className="h-4 w-4" />
      </Button>

      {/* Profile dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full outline-none ring-ring focus-visible:ring-2">
            <Avatar className="h-8 w-8 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => navigate("/perfil")}>
            <User className="mr-2 h-4 w-4" />
            Meu Perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/dashboard")} className="sm:hidden">
            <GraduationCap className="mr-2 h-4 w-4" />
            Modo Aluno
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={async () => { await signOut(); navigate("/"); }}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};

export default AdminTopBar;
