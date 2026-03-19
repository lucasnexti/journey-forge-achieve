import { useState, useEffect } from "react";
import { BookOpen, GraduationCap, Users, FileText, ChevronRight, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";

const AdminDashboard = () => {
  const [stats, setStats] = useState({ tracks: 0, enrollments: 0, users: 0, activeEnrollments: 0, completedEnrollments: 0, certificates: 0 });
  const [recentEnrollments, setRecentEnrollments] = useState<any[]>([]);
  const [enrollmentsByDay, setEnrollmentsByDay] = useState<any[]>([]);
  const [inactiveUsers, setInactiveUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const [tracksRes, profilesRes, enrollmentsRes, certsRes] = await Promise.all([
      supabase.from("tracks").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("profiles").select("id, created_at, is_active", { count: "exact" }),
      supabase.from("enrollments").select("id, status, enrolled_at, track_id, tracks(title)"),
      supabase.from("certificates").select("id", { count: "exact", head: true }),
    ]);

    const enrollments = (enrollmentsRes.data || []) as any[];
    const profiles = (profilesRes.data || []) as any[];
    const active = enrollments.filter(e => e.status === "active").length;
    const completed = enrollments.filter(e => e.status === "completed").length;

    // Inactive users (no enrollment)
    const enrolledUserIds = new Set(enrollments.map(e => e.user_id));
    const inactive = profiles.filter(p => !enrolledUserIds.has(p.id)).length;
    setInactiveUsers(inactive);

    setStats({
      tracks: tracksRes.count || 0,
      enrollments: enrollments.length,
      users: profilesRes.count || 0,
      activeEnrollments: active,
      completedEnrollments: completed,
      certificates: certsRes.count || 0,
    });

    // Enrollments by day (last 7 days)
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const byDay = last7.map(date => {
      const dayStr = date.toISOString().split('T')[0];
      const count = enrollments.filter(e => e.enrolled_at?.startsWith(dayStr)).length;
      return { day: days[date.getDay()], value: count };
    });
    setEnrollmentsByDay(byDay);

    // Recent enrollments
    const recent = enrollments
      .sort((a: any, b: any) => new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime())
      .slice(0, 5);
    setRecentEnrollments(recent);

    setLoading(false);
  };

  const statCards = [
    { value: stats.tracks, label: "Trilhas ativas", icon: BookOpen, color: "text-primary", link: "/admin/trilhas-gestao" },
    { value: stats.enrollments, label: "Matrículas totais", sublabel: `${stats.activeEnrollments} ativas`, icon: GraduationCap, color: "text-primary", link: "/admin/matriculas" },
    { value: stats.users, label: "Usuários cadastrados", icon: Users, color: "text-primary", link: "/admin/usuarios" },
    { value: stats.completedEnrollments, label: "Conclusões", sublabel: `${stats.certificates} certificados`, icon: TrendingUp, color: "text-primary", link: "/admin/relatorio-progresso" },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="font-display text-xl font-bold text-primary">Dashboard Administrativo</h1>
      <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />

      {/* KPI Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="card-surface p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-3xl font-bold text-foreground">{stat.value}</p>
                <p className={`mt-1 text-sm font-medium ${stat.color}`}>{stat.label}</p>
                {stat.sublabel && <p className="text-xs text-muted-foreground">{stat.sublabel}</p>}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
            <Link to={stat.link} className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              Ver detalhes <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </div>

      {/* Alert: Inactive users */}
      {inactiveUsers > 0 && (
        <div className="mt-6 card-surface border-warning/30 bg-warning/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">{inactiveUsers} usuário(s) sem matrícula</p>
            <p className="text-xs text-muted-foreground">Considere enviar notificações ou matriculá-los em trilhas.</p>
          </div>
          <Link to="/admin/notificacoes" className="ml-auto text-xs font-medium text-primary hover:underline shrink-0">
            Enviar notificação
          </Link>
        </div>
      )}

      {/* Charts */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-surface p-5">
          <h3 className="text-sm font-semibold text-foreground">Matrículas nos últimos 7 dias</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={enrollmentsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: 'hsl(var(--accent))', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent activity */}
        <div className="card-surface p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Atividade Recente</h3>
          {recentEnrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma matrícula recente.</p>
          ) : (
            <div className="space-y-3">
              {recentEnrollments.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <GraduationCap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.tracks?.title || "Trilha"}</p>
                    <p className="text-xs text-muted-foreground">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {new Date(e.enrolled_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    e.status === "active" ? "bg-success/10 text-success" :
                    e.status === "completed" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                  }`}>
                    {e.status === "active" ? "Ativa" : e.status === "completed" ? "Concluída" : "Cancelada"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
