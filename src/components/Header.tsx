import { Link, useLocation } from "react-router-dom";
import { BookOpen, BarChart3 } from "lucide-react";

const Header = () => {
  const location = useLocation();

  const links = [
    { to: "/", label: "Trilhas", icon: BookOpen },
    { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-nexti">
            <span className="font-display text-base font-extrabold text-primary-foreground tracking-tight">N</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold text-foreground leading-tight">
              Universidade <span className="text-gradient-nexti">Nexti</span>
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground leading-none">
              Cooperativa
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-gradient-nexti text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default Header;
