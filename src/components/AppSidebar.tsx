import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, BarChart3, LogOut, Shield, User, Sun, Moon, Coins, Library, Zap, ChevronDown, Award, GraduationCap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useTheme } from "@/hooks/useTheme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { to: "/dashboard", label: "Trilhas", icon: BookOpen },
  { to: "/loja", label: "Loja de Prêmios", icon: Coins },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/base-conhecimento", label: "Base de Conhecimento", icon: Library },
  { to: "/quiz-nexti", label: "Quiz Nexti", icon: Zap },
  { to: "/insignias", label: "Insígnias", icon: Award },
  { to: "/treinamento-presencial", label: "Treinamento Presencial", icon: GraduationCap },
];

const iconMap: Record<string, string> = {
  award: "🏆",
  star: "⭐",
  zap: "⚡",
  trophy: "🏅",
  medal: "🎖️",
  flame: "🔥",
  target: "🎯",
  crown: "👑",
  rocket: "🚀",
  gem: "💎",
  heart: "❤️",
  shield: "🛡️",
  "book-open": "📖",
};

interface UserBadge {
  name: string;
  icon: string | null;
}

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { theme, toggleTheme } = useTheme();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [badges, setBadges] = useState<UserBadge[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_badges")
      .select("badges(name, icon)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          setBadges(
            data.map((d: any) => ({
              name: d.badges?.name ?? "Badge",
              icon: d.badges?.icon ?? "award",
            }))
          );
        }
      });
  }, [user]);

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "U";

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

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.to || (item.to === "/dashboard" && location.pathname.startsWith("/trilha/"));
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

              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname.startsWith("/admin")}
                    tooltip={collapsed ? "Admin" : undefined}
                  >
                    <Link
                      to="/admin"
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                        location.pathname.startsWith("/admin")
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Shield className="h-4.5 w-4.5 shrink-0" />
                      {!collapsed && <span>Admin</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Badges / Insígnias */}
        {badges.length > 0 && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Award className="h-3.5 w-3.5 mr-1.5 inline" />
                Insígnias
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <div className={cn(
                "px-3 pt-1 pb-2",
                collapsed ? "flex flex-col items-center gap-1" : "flex flex-wrap gap-1.5"
              )}>
                {badges.slice(0, collapsed ? 5 : 12).map((badge, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          "inline-flex items-center justify-center rounded-md bg-primary/5 border border-primary/10 cursor-default transition-colors hover:bg-primary/10",
                          collapsed ? "h-8 w-8 text-base" : "h-7 px-2 gap-1 text-xs"
                        )}
                      >
                        <span>{iconMap[badge.icon || "award"] || "🏆"}</span>
                        {!collapsed && (
                          <span className="text-foreground/80 font-medium truncate max-w-[80px]">
                            {badge.name}
                          </span>
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right">{badge.name}</TooltipContent>
                  </Tooltip>
                ))}
                {badges.length > (collapsed ? 5 : 12) && (
                  <span className={cn(
                    "inline-flex items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-medium",
                    collapsed ? "h-8 w-8" : "h-7 px-2"
                  )}>
                    +{badges.length - (collapsed ? 5 : 12)}
                  </span>
                )}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
