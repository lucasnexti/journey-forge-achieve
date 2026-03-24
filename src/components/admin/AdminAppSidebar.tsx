import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutGrid, Route, BookOpen, Star, GraduationCap, Users as UsersIcon,
  Layers, BarChart3, FileText, LogOut, Award, ShieldCheck, Bell, Palette,
  ClipboardCheck, MessageSquare, Sun, Moon, ChevronDown, User, Zap, Gift, Activity
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutGrid },
    ],
  },
  {
    label: "Conteúdo",
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
    items: [
      { to: "/admin/usuarios", label: "Usuários", icon: UsersIcon },
      { to: "/admin/matriculas", label: "Matrículas", icon: GraduationCap },
      { to: "/admin/certificados", label: "Certificados", icon: ShieldCheck },
    ],
  },
  {
    label: "Engajamento",
    items: [
      { to: "/admin/gamificacao", label: "Gamificação", icon: Award },
      { to: "/admin/premios", label: "Prêmios & Resgates", icon: Gift },
      { to: "/admin/forum-gestao", label: "Fórum / Mural", icon: MessageSquare },
      { to: "/admin/notificacoes", label: "Notificações", icon: Bell },
      { to: "/admin/avaliacoes", label: "Avaliações CSAT", icon: Star },
    ],
  },
  {
    label: "Configuração",
    items: [
      { to: "/admin/personalizacao", label: "Personalização", icon: Palette },
      { to: "/admin/relatorio-progresso", label: "Relatórios", icon: BarChart3 },
      { to: "/admin/logs", label: "Logs", icon: FileText },
    ],
  },
];

export function AdminAppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "AD";

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent className="py-4">
        {/* Logo */}
        <div className={cn("px-4 mb-6 flex items-center gap-2.5", collapsed && "justify-center px-2")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-nexti shadow-md shadow-primary/20">
            <span className="font-display text-sm font-extrabold text-primary-foreground tracking-tight">N</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-sm font-bold text-foreground leading-tight">
                Universidade
              </span>
              <span className="text-gradient-nexti font-display text-xs font-bold leading-tight">Nexti</span>
            </div>
          )}
        </div>

        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.to;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={collapsed ? item.label : undefined}
                      >
                        <Link
                          to={item.to}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                            isActive
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <item.icon className={cn("h-4.5 w-4.5 shrink-0", isActive && "text-primary")} />
                          {!collapsed && <span>{item.label}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* Modo Aluno link */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={collapsed ? "Modo Aluno" : undefined}
                >
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                  >
                    <GraduationCap className="h-4.5 w-4.5 shrink-0" />
                    {!collapsed && <span>Modo Aluno</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full",
            collapsed && "justify-center px-2"
          )}
        >
          {theme === "light" ? <Moon className="h-4 w-4 shrink-0" /> : <Sun className="h-4 w-4 shrink-0" />}
          {!collapsed && <span>{theme === "light" ? "Modo escuro" : "Modo claro"}</span>}
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors w-full outline-none",
              collapsed && "justify-center px-2"
            )}>
              <Avatar className="h-8 w-8 border border-border shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{userInitials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={collapsed ? "right" : "top"} align="start" className="w-48">
            <DropdownMenuItem onClick={() => navigate("/perfil")}>
              <User className="mr-2 h-4 w-4" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
