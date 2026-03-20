import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
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

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, cargo")
        .eq("empresa", userEmpresa)
        .eq("is_active", true);

      setColleagues(profiles || []);

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

  const totalUsers = colleagues.length;
  const totalEnrollments = enrollments.length;
  const completedEnrollments = enrollments.filter((e) => e.status === "completed").length;
  const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

  const trackMap = new Map<string, { title: string; active: number; completed: number }>();
  enrollments.forEach((e) => {
    const title = e.tracks?.title || "Sem trilha";
    const existing = trackMap.get(e.track_id) || { title, active: 0, completed: 0 };
    if (e.status === "completed") existing.completed++;
    else existing.active++;
    trackMap.set(e.track_id, existing);
  });
  const trackChartData = Array.from(trackMap.values());

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

  const userSummary = filteredColleagues.map((c) => {
    const userEnrollments = enrollments.filter((e) => e.user_id === c.user_id);
    const completed = userEnrollments.filter((e) => e.status === "completed").length;
    const total = userEnrollments.length;
    return { ...c, completed, total };
  });

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>

      <div className="bg-gradient-nexti">
        <div className="container py-6 sm:py-10">
          <div className="flex items-center gap-2 sm:gap-3 mb-1">
            <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground/80" />
            <h1 className="font-display text-lg sm:text-3xl font-extrabold text-primary-foreground truncate">
              Relatórios — {empresa || "Sua Empresa"}
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-primary-foreground/80">
            Acompanhe o progresso de todos os colaboradores.
          </p>

          <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
            {[
              { icon: Users, label: "Colaboradores", value: totalUsers },
              { icon: BookOpen, label: "Matrículas", value: totalEnrollments },
              { icon: Trophy, label: "Conclusões", value: completedEnrollments },
              { icon: Clock, label: "Taxa Conclusão", value: `${completionRate}%` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2 sm:gap-3 rounded-xl bg-primary-foreground/10 backdrop-blur-sm p-3 sm:p-4 border border-primary-foreground/10">
                <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-primary-foreground/20 shrink-0">
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="tabular-nums font-display text-sm sm:text-lg font-bold text-primary-foreground">{value}</p>
                  <p className="text-[10px] sm:text-xs text-primary-foreground/70 truncate">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="container py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* Charts */}
        {trackChartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 card-surface p-4 sm:p-6">
              <h2 className="font-display text-sm sm:text-base font-semibold text-foreground mb-4">Matrículas por Trilha</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trackChartData} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="title" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="completed" name="Concluídos" stackId="a" fill="hsl(var(--success))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="active" name="Em andamento" stackId="a" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card-surface p-4 sm:p-6">
              <h2 className="font-display text-sm sm:text-base font-semibold text-foreground mb-4">Status Geral</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h2 className="font-display text-sm sm:text-base font-semibold text-foreground">Progresso por Colaborador</h2>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar colaborador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-auto rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {!empresa ? (
            <div className="card-surface p-6 sm:p-8 text-center text-muted-foreground">
              <p>Seu perfil não possui uma empresa vinculada.</p>
            </div>
          ) : userSummary.length === 0 ? (
            <div className="card-surface p-6 sm:p-8 text-center text-muted-foreground">
              <p>Nenhum colaborador encontrado.</p>
            </div>
          ) : (
            <div className="card-surface overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Colaborador</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Cargo</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Matrículas</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Concluídas</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {userSummary.map((u) => {
                    const pct = u.total > 0 ? Math.round((u.completed / u.total) * 100) : 0;
                    return (
                      <tr key={u.user_id} className="border-b border-border/30 last:border-0">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{u.nome}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">{u.cargo || "—"}</td>
                        <td className="px-4 py-3 text-center tabular-nums text-sm text-foreground">{u.total}</td>
                        <td className="px-4 py-3 text-center tabular-nums text-sm text-foreground">{u.completed}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="h-2 w-14 sm:w-20 rounded-full bg-secondary overflow-hidden">
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
