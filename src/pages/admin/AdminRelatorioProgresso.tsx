import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, BookOpen, GraduationCap, TrendingUp, Download, FileText } from "lucide-react";

const COLORS = ["hsl(18, 100%, 55%)", "hsl(152, 60%, 45%)", "hsl(38, 92%, 50%)", "hsl(210, 40%, 60%)"];

const AdminRelatorioProgresso = () => {
  const [stats, setStats] = useState({ totalUsers: 0, totalTracks: 0, totalEnrollments: 0, activeEnrollments: 0, completedEnrollments: 0, certificates: 0 });
  const [enrollmentsByTrack, setEnrollmentsByTrack] = useState<{ name: string; value: number }[]>([]);
  const [enrollmentsByStatus, setEnrollmentsByStatus] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackFilter, setTrackFilter] = useState("all");
  const [tracks, setTracks] = useState<any[]>([]);

  useEffect(() => { fetchStats(); }, [trackFilter]);

  const fetchStats = async () => {
    setLoading(true);
    // Agregação feita no banco: evita baixar todas as matrículas para o navegador
    const [tracksRes, reportRes] = await Promise.all([
      supabase.from("tracks").select("id, title").eq("is_active", true).order("title"),
      supabase.rpc("admin_enrollment_report", {
        _track_id: trackFilter === "all" ? null : trackFilter,
      }),
    ]);

    if (tracksRes.data) setTracks(tracksRes.data);

    const report = (reportRes.data || {}) as any;
    const byStatus = (report.by_status || []) as { status: string; value: number }[];
    const statusValue = (s: string) => byStatus.find((r) => r.status === s)?.value || 0;

    setStats({
      totalUsers: report.total_users || 0,
      totalTracks: report.total_tracks || 0,
      totalEnrollments: report.total_enrollments || 0,
      activeEnrollments: statusValue("active"),
      completedEnrollments: statusValue("completed"),
      certificates: report.certificates || 0,
    });

    setEnrollmentsByTrack(((report.by_track || []) as { name: string; value: number }[]));
    setEnrollmentsByStatus(
      byStatus.map((r) => ({
        name: r.status === "active" ? "Ativa" : r.status === "completed" ? "Concluída" : "Cancelada",
        value: r.value,
      }))
    );
    setLoading(false);
  };


  const exportCSV = () => {
    const headers = "Métrica,Valor\n";
    const rows = [
      `Usuários,${stats.totalUsers}`,
      `Trilhas Ativas,${stats.totalTracks}`,
      `Matrículas Totais,${stats.totalEnrollments}`,
      `Matrículas Ativas,${stats.activeEnrollments}`,
      `Conclusões,${stats.completedEnrollments}`,
      `Certificados,${stats.certificates}`,
      "",
      "Trilha,Matrículas",
      ...enrollmentsByTrack.map(e => `${e.name},${e.value}`),
      "",
      "Status,Quantidade",
      ...enrollmentsByStatus.map(e => `${e.name},${e.value}`),
    ].join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-progresso-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const statCards = [
    { icon: Users, label: "Usuários", value: stats.totalUsers },
    { icon: BookOpen, label: "Trilhas Ativas", value: stats.totalTracks },
    { icon: GraduationCap, label: "Matrículas", value: stats.totalEnrollments },
    { icon: TrendingUp, label: "Conclusões", value: stats.completedEnrollments },
  ];

  return (
    <AdminLayout>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Relatório de Progresso</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
        </div>
        <div className="flex gap-2">
          <Select value={trackFilter} onValueChange={setTrackFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar trilha" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as trilhas</SelectItem>
              {tracks.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV} className="gap-1">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="mt-12 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            {statCards.map(({ icon: Icon, label, value }) => (
              <div key={label} className="card-surface p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="tabular-nums font-display text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card-surface p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Matrículas por Trilha</h3>
              {enrollmentsByTrack.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={enrollmentsByTrack}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-12">Nenhuma matrícula registrada.</p>}
            </div>

            <div className="card-surface p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Matrículas por Status</h3>
              {enrollmentsByStatus.length > 0 ? (
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={enrollmentsByStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {enrollmentsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-12">Nenhuma matrícula registrada.</p>}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminRelatorioProgresso;
