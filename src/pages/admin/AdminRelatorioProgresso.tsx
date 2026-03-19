import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, BookOpen, GraduationCap, TrendingUp } from "lucide-react";

const COLORS = ["hsl(18, 100%, 55%)", "hsl(152, 60%, 45%)", "hsl(38, 92%, 50%)", "hsl(210, 40%, 60%)"];

const AdminRelatorioProgresso = () => {
  const [stats, setStats] = useState({ totalUsers: 0, totalTracks: 0, totalEnrollments: 0, activeEnrollments: 0 });
  const [enrollmentsByTrack, setEnrollmentsByTrack] = useState<{ name: string; value: number }[]>([]);
  const [enrollmentsByStatus, setEnrollmentsByStatus] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);

    const [profilesRes, tracksRes, enrollmentsRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("tracks").select("id, title", { count: "exact" }).eq("is_active", true),
      supabase.from("enrollments").select("id, status, track_id, tracks(title)"),
    ]);

    const totalUsers = profilesRes.count || 0;
    const totalTracks = tracksRes.count || 0;
    const enrollments = (enrollmentsRes.data || []) as any[];
    const totalEnrollments = enrollments.length;
    const activeEnrollments = enrollments.filter((e) => e.status === "active").length;

    setStats({ totalUsers, totalTracks, totalEnrollments, activeEnrollments });

    // Group by track
    const byTrack: Record<string, number> = {};
    enrollments.forEach((e) => {
      const name = e.tracks?.title || "Sem trilha";
      byTrack[name] = (byTrack[name] || 0) + 1;
    });
    setEnrollmentsByTrack(Object.entries(byTrack).map(([name, value]) => ({ name, value })));

    // Group by status
    const byStatus: Record<string, number> = {};
    enrollments.forEach((e) => {
      const s = e.status === "active" ? "Ativa" : e.status === "completed" ? "Concluída" : "Cancelada";
      byStatus[s] = (byStatus[s] || 0) + 1;
    });
    setEnrollmentsByStatus(Object.entries(byStatus).map(([name, value]) => ({ name, value })));

    setLoading(false);
  };

  const statCards = [
    { icon: Users, label: "Usuários", value: stats.totalUsers },
    { icon: BookOpen, label: "Trilhas Ativas", value: stats.totalTracks },
    { icon: GraduationCap, label: "Matrículas", value: stats.totalEnrollments },
    { icon: TrendingUp, label: "Matrículas Ativas", value: stats.activeEnrollments },
  ];

  return (
    <AdminLayout>
      <h1 className="font-display text-xl font-bold text-primary">Relatório de Progresso</h1>
      <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />

      {loading ? (
        <div className="mt-12 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            {statCards.map(({ icon: Icon, label, value }) => (
              <div key={label} className="card-surface p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="tabular-nums font-display text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Enrollments by track */}
            <div className="card-surface p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Matrículas por Trilha</h3>
              {enrollmentsByTrack.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={enrollmentsByTrack}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhuma matrícula registrada.</p>
              )}
            </div>

            {/* Enrollments by status */}
            <div className="card-surface p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Matrículas por Status</h3>
              {enrollmentsByStatus.length > 0 ? (
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={enrollmentsByStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {enrollmentsByStatus.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhuma matrícula registrada.</p>
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminRelatorioProgresso;
