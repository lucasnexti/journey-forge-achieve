import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Trophy, BookOpen, Users, Building2, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface CompanyUser {
  user_id: string;
  nome: string;
  cargo: string | null;
}

interface EnrollmentWithTrack {
  id: string;
  user_id: string;
  track_id: string;
  status: string | null;
  enrolled_at: string | null;
  completed_at: string | null;
  tracks: { title: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "hsl(var(--success))",
  active: "hsl(var(--primary))",
  cancelled: "hsl(var(--destructive))",
};

const ReportPage = () => {
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState<string | null>(null);
  const [colleagues, setColleagues] = useState<CompanyUser[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentWithTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Get current user's empresa
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa")
        .eq("user_id", user.id)
        .maybeSingle();

      const userEmpresa = profile?.empresa;
      setEmpresa(userEmpresa);

      if (!userEmpresa) {
        setLoading(false);
        return;
      }

      // Fetch colleagues from same empresa (RLS handles filtering)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, cargo")
        .eq("empresa", userEmpresa)
        .eq("is_active", true);

      setColleagues(profiles || []);

      // Fetch enrollments for same-company users
      const { data: enrollData } = await supabase
        .from("enrollments")
        .select("id, user_id, track_id, status, enrolled_at, completed_at, tracks(title)");

      setEnrollments((enrollData as unknown as EnrollmentWithTrack[]) || []);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const filteredColleagues = colleagues.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  // KPIs
  const totalUsers = colleagues.length;
  const totalEnrollments = enrollments.length;
  const completedEnrollments = enrollments.filter((e) => e.status === "completed").length;
  const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

  // Chart: enrollments per track
  const trackMap = new Map<string, { title: string; active: number; completed: number }>();
  enrollments.forEach((e) => {
    const title = e.tracks?.title || "Sem trilha";
    const existing = trackMap.get(e.track_id) || { title, active: 0, completed: 0 };
    if (e.status === "completed") existing.completed++;
    else existing.active++;
    trackMap.set(e.track_id, existing);
  });
  const trackChartData = Array.from(trackMap.values());

  // Chart: status distribution
  const statusCounts = { active: 0, completed: 0, cancelled: 0 };
  enrollments.forEach((e) => {
    const s = e.status || "active";
    if (s in statusCounts) statusCounts[s as keyof typeof statusCounts]++;
  });
  const pieData = Object.entries(statusCounts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: key === "active" ? "Em andamento" : key === "completed" ? "Concluído" : "Cancelado",
      value,
      color: STATUS_COLORS[key] || "hsl(var(--muted))",
    }));

  // Per-user summary
  const userSummary = filteredColleagues.map((c) => {
    const userEnrollments = enrollments.filter((e) => e.user_id === c.user_id);
    const completed = userEnrollments.filter((e) => e.status === "completed").length;
    const total = userEnrollments.length;
    return { ...c, completed, total };
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="bg-gradient-nexti">
        <div className="container py-10">
          <div className="flex items-center gap-3 mb-1">
            <Building2 className="h-6 w-6 text-primary-foreground/80" />
            <h1 className="font-display text-3xl font-extrabold text-primary-foreground">
              Relatórios — {empresa || "Sua Empresa"}
            </h1>
          </div>
          <p className="mt-1 text-primary-foreground/80">
            Acompanhe o progresso de todos os colaboradores da sua instituição.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
            {[
              { icon: Users, label: "Colaboradores", value: totalUsers },
              { icon: BookOpen, label: "Matrículas", value: totalEnrollments },
              { icon: Trophy, label: "Conclusões", value: completedEnrollments },
              { icon: Clock, label: "Taxa de Conclusão", value: `${completionRate}%` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl bg-primary-foreground/10 backdrop-blur-sm p-4 border border-primary-foreground/10">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/20">
                  <Icon className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="tabular-nums font-display text-lg font-bold text-primary-foreground">{value}</p>
                  <p className="text-xs text-primary-foreground/70">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="container py-8 space-y-8">
        {/* Charts */}
        {trackChartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card-surface p-6">
              <h2 className="font-display text-base font-semibold text-foreground mb-4">Matrículas por Trilha</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trackChartData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="title" width={140} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="completed" name="Concluídos" stackId="a" fill="hsl(var(--success))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="active" name="Em andamento" stackId="a" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card-surface p-6">
              <h2 className="font-display text-base font-semibold text-foreground mb-4">Status Geral</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* User table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold text-foreground">Progresso por Colaborador</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar colaborador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {!empresa ? (
            <div className="card-surface p-8 text-center text-muted-foreground">
              <p>Seu perfil não possui uma empresa vinculada. Solicite ao administrador para configurar.</p>
            </div>
          ) : userSummary.length === 0 ? (
            <div className="card-surface p-8 text-center text-muted-foreground">
              <p>Nenhum colaborador encontrado.</p>
            </div>
          ) : (
            <div className="card-surface overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/50">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Colaborador</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Cargo</th>
                    <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Trilhas Matriculadas</th>
                    <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Concluídas</th>
                    <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {userSummary.map((u) => {
                    const pct = u.total > 0 ? Math.round((u.completed / u.total) * 100) : 0;
                    return (
                      <tr key={u.user_id} className="border-b border-border/30 last:border-0">
                        <td className="px-5 py-4 text-sm font-medium text-foreground">{u.nome}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{u.cargo || "—"}</td>
                        <td className="px-5 py-4 text-center tabular-nums text-sm text-foreground">{u.total}</td>
                        <td className="px-5 py-4 text-center tabular-nums text-sm text-foreground">{u.completed}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="h-2 w-20 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-xs text-muted-foreground">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ReportPage;
