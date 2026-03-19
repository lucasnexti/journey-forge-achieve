import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutGrid, Route, StickyNote, MessageSquare,
  BookOpen, Star, GraduationCap, Users as UsersIcon,
  Layers, BarChart3, FileText, ChevronLeft, ChevronRight, LogOut
} from "lucide-react";

const dashboardLinks = [
  { to: "/admin", label: "Meus Cursos", icon: LayoutGrid },
  { to: "/admin/trilhas", label: "Trilhas", icon: Route },
  { to: "/admin/anotacoes", label: "Minhas Anotações", icon: StickyNote },
  { to: "/admin/foruns", label: "Fóruns", icon: MessageSquare },
];

const managementLinks = [
  { to: "/admin/cursos-ead", label: "Cursos EAD", icon: BookOpen },
  { to: "/admin/avaliacoes", label: "Avaliações NPS/CSAT", icon: Star },
  { to: "/admin/matriculas", label: "Matrículas EAD", icon: GraduationCap },
  { to: "/admin/treinamentos", label: "Trein. Presenciais", icon: Layers },
  { to: "/admin/trilhas-gestao", label: "Trilhas", icon: Route },
  { to: "/admin/relatorio-progresso", label: "Relatório de Progresso", icon: BarChart3 },
  { to: "/admin/usuarios", label: "Usuários", icon: UsersIcon },
  { to: "/admin/logs", label: "Logs", icon: FileText },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const AdminSidebar = ({ collapsed, onToggle }: AdminSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const NavItem = ({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) => {
    const isActive = location.pathname === to;
    return (
      <Link
        to={to}
        className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
        }`}
        title={collapsed ? label : undefined}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col bg-primary transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="flex h-20 items-center justify-center px-4">
        {!collapsed ? (
          <span className="font-display text-3xl font-extrabold italic text-primary-foreground">nexti</span>
        ) : (
          <span className="font-display text-xl font-extrabold text-primary-foreground">N</span>
        )}
      </div>

      {/* Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:bg-secondary"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {!collapsed && (
          <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-primary-foreground/40">
            Dashboard
          </p>
        )}
        <div className="space-y-0.5">
          {dashboardLinks.map((link) => (
            <NavItem key={link.to} {...link} />
          ))}
        </div>

        <div className="my-4 border-t border-primary-foreground/10" />

        {!collapsed && (
          <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-primary-foreground/40">
            Gerenciamento
          </p>
        )}
        <div className="space-y-0.5">
          {managementLinks.map((link) => (
            <NavItem key={link.to} {...link} />
          ))}
        </div>
      </nav>

      {/* Logout */}
      <div className="border-t border-primary-foreground/10 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
