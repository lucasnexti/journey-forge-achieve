import { BookOpen, GraduationCap, Users, FileText, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import AdminLayout from "@/components/admin/AdminLayout";
import { tracks } from "@/lib/data";

const matriculasData = [
  { day: "Qui", value: 5 },
  { day: "Sex", value: 8 },
  { day: "Sáb", value: 3 },
  { day: "Dom", value: 220 },
  { day: "Seg", value: 15 },
  { day: "Ter", value: 10 },
  { day: "Qua", value: 12 },
];

const certificadosData = [
  { day: "Qui", value: 4 },
  { day: "Sex", value: 0 },
  { day: "Sáb", value: 8 },
  { day: "Dom", value: 5 },
  { day: "Seg", value: 8 },
  { day: "Ter", value: 12 },
  { day: "Qua", value: 12 },
];

const stats = [
  {
    value: "41",
    label: "Cursos ativos no total",
    icon: BookOpen,
    color: "text-primary",
    link: "/admin/cursos-ead",
  },
  {
    value: "82",
    label: "Alunos ativos, sendo",
    sublabel: "1496 Matrículas ativas",
    icon: GraduationCap,
    color: "text-primary",
    link: "/admin/matriculas",
  },
  {
    value: "1679",
    label: "Usuários ativos no total",
    icon: Users,
    color: "text-primary",
    link: "/admin/usuarios",
  },
];

const RightPanel = () => (
  <div>
    <h2 className="font-display text-lg font-bold text-primary">Minhas Trilhas</h2>
    <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />

    <div className="mt-6 card-surface p-5">
      <h3 className="font-display text-base font-bold text-foreground">
        Conheça suas trilhas disponíveis!
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Promover conhecimento é o lema de nossa empresa, conheça os treinamentos disponíveis em sua área de atuação e setores diversos.
      </p>
    </div>

    <div className="mt-4 card-surface p-4">
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
          <div className="flex h-full w-full items-center justify-center bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-display text-sm font-bold text-primary">NEXTI - LIDERANÇAS</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Data início: 23/12/2025
          </p>
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> Seleção de cursos
          </p>
        </div>
      </div>
      <Link
        to="/admin/trilhas"
        className="mt-3 flex w-full items-center justify-center rounded-full border-2 border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        Acessar trilha
      </Link>
    </div>
  </div>
);

const AdminDashboard = () => {
  return (
    <AdminLayout rightPanel={<RightPanel />}>
      {/* Title */}
      <h1 className="font-display text-xl font-bold text-primary">Minha Dashboard</h1>
      <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />

      {/* Stats Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="card-surface p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-3xl font-light text-foreground/70">{stat.value}</p>
                <p className={`mt-1 text-sm font-medium ${stat.color}`}>{stat.label}</p>
                {stat.sublabel && (
                  <p className={`text-sm font-medium ${stat.color}`}>{stat.sublabel}</p>
                )}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
            <Link
              to={stat.link}
              className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Ver detalhes <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Matrículas Chart */}
        <div className="card-surface p-5">
          <h3 className="text-sm font-medium text-foreground">Matrículas realizadas nos últimos 07 dias</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={matriculasData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--accent))', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Certificados Chart */}
        <div className="card-surface p-5">
          <h3 className="text-sm font-medium text-foreground">Certificados emitidos nos últimos 07 dias</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={certificadosData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-muted-foreground text-center">
            Confira mais detalhes em{" "}
            <Link to="/admin/relatorio-progresso" className="font-semibold text-foreground underline">
              Relatórios
            </Link>
          </p>
        </div>
      </div>

      {/* Meu Progresso */}
      <div className="mt-8">
        <h2 className="font-display text-lg font-bold text-primary">Meu Progresso</h2>
        <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />

        <div className="mt-4 card-surface p-5">
          <div className="space-y-4">
            {tracks.map((track) => (
              <div key={track.id} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{track.title}</p>
                  <p className="text-xs text-muted-foreground">{track.totalLessons} aulas · {track.estimatedHours}h</p>
                </div>
                <div className="w-32">
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-gradient-nexti" style={{ width: "0%" }} />
                  </div>
                </div>
                <span className="tabular-nums text-xs font-medium text-muted-foreground w-10 text-right">0%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
