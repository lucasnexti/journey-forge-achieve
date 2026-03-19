import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutGrid, Route, BookOpen, Star, GraduationCap, Users as UsersIcon,
  Layers, BarChart3, FileText, LogOut, Award, ShieldCheck, Bell, Palette,
  ClipboardCheck, MessageSquare, ChevronDown, X, Zap
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Visão Geral",
    icon: LayoutGrid,
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutGrid },
    ],
  },
  {
    label: "Conteúdo",
    icon: BookOpen,
    items: [
      { to: "/admin/cursos-ead", label: "Cursos EAD", icon: BookOpen },
      { to: "/admin/trilhas-gestao", label: "Trilhas", icon: Route },
      { to: "/admin/quizzes", label: "Quizzes", icon: ClipboardCheck },
      { to: "/admin/quiz-nexti", label: "Quiz Nexti", icon: Zap },
      { to: "/admin/treinamentos", label: "Trein. Presenciais", icon: Layers },
    ],
  },
  {
    label: "Pessoas",
    icon: UsersIcon,
    items: [
      { to: "/admin/usuarios", label: "Usuários", icon: UsersIcon },
      { to: "/admin/matriculas", label: "Matrículas", icon: GraduationCap },
      { to: "/admin/certificados", label: "Certificados", icon: ShieldCheck },
    ],
  },
  {
    label: "Engajamento",
    icon: Award,
    items: [
      { to: "/admin/gamificacao", label: "Gamificação", icon: Award },
      { to: "/admin/forum-gestao", label: "Fórum / Mural", icon: MessageSquare },
      { to: "/admin/notificacoes", label: "Notificações", icon: Bell },
      { to: "/admin/avaliacoes", label: "Avaliações CSAT", icon: Star },
    ],
  },
  {
    label: "Configuração",
    icon: Palette,
    items: [
      { to: "/admin/personalizacao", label: "Personalização", icon: Palette },
      { to: "/admin/relatorio-progresso", label: "Relatórios", icon: BarChart3 },
      { to: "/admin/logs", label: "Logs", icon: FileText },
    ],
  },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const AdminSidebar = ({ collapsed, onToggle, mobileOpen, onMobileClose }: AdminSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  const groupContainsActive = (group: NavGroup) =>
    group.items.some((item) => isActive(item.to));

  // Sidebar content shared between desktop and mobile
  const sidebarContent = (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4">
          {!collapsed ? (
            <span className="font-display text-2xl font-extrabold italic text-primary-foreground">
              nexti
            </span>
          ) : (
            <span className="mx-auto font-display text-xl font-extrabold text-primary-foreground">
              N
            </span>
          )}
          {/* Mobile close button */}
          {mobileOpen && (
            <button onClick={onMobileClose} className="text-primary-foreground/70 hover:text-primary-foreground lg:hidden">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {navGroups.map((group) => {
            const active = groupContainsActive(group);

            if (collapsed) {
              // Collapsed: show only icons with tooltips
              return (
                <div key={group.label} className="space-y-0.5 py-1">
                  {group.items.map((item) => (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.to}
                          className={cn(
                            "flex h-9 w-full items-center justify-center rounded-lg transition-colors",
                            isActive(item.to)
                              ? "bg-primary-foreground/20 text-primary-foreground shadow-sm"
                              : "text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.badge && item.badge > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              );
            }

            // Expanded: collapsible groups
            return (
              <Collapsible key={group.label} defaultOpen={active}>
                <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground/50 hover:text-primary-foreground/70 transition-colors">
                  <group.icon className="h-3.5 w-3.5" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 pl-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={onMobileClose}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                        isActive(item.to)
                          ? "bg-primary-foreground/15 text-primary-foreground shadow-sm"
                          : "text-primary-foreground/65 hover:bg-primary-foreground/8 hover:text-primary-foreground"
                      )}
                    >
                      {/* Active indicator bar */}
                      {isActive(item.to) && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary-foreground" />
                      )}
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.badge && item.badge > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-primary-foreground/10 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary-foreground/60 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Sair</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">Sair</TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col bg-primary transition-all duration-300",
          // Desktop
          "max-lg:translate-x-[-100%]",
          collapsed ? "lg:w-16" : "lg:w-60",
          // Mobile
          mobileOpen && "max-lg:translate-x-0 max-lg:w-72"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default AdminSidebar;
