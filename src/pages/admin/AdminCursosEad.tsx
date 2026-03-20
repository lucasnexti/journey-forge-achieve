import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import PaginationControls from "@/components/admin/PaginationControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, Video, Users, Eye, EyeOff } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const PAGE_SIZE_DEFAULT = 25;

const AdminCursosEad = () => {
  const [tracks, setTracks] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, lessons: 0, enrollments: 0 });

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchTracks(); }, [page, pageSize, debouncedSearch]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const fetchStats = async () => {
    const [{ count: total }, { count: active }, { count: lessons }, { count: enrollments }] = await Promise.all([
      supabase.from("tracks").select("*", { count: "exact", head: true }),
      supabase.from("tracks").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("lessons").select("*", { count: "exact", head: true }),
      supabase.from("enrollments").select("*", { count: "exact", head: true }),
    ]);
    setStats({ total: total || 0, active: active || 0, lessons: lessons || 0, enrollments: enrollments || 0 });
  };

  const fetchTracks = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("tracks")
      .select("*, lessons(id)", { count: "exact" })
      .order("order_index")
      .range(from, to);

    if (debouncedSearch) {
      query = query.or(`title.ilike.%${debouncedSearch}%,category.ilike.%${debouncedSearch}%`);
    }

    const { data, count } = await query;
    setTracks(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Cursos EAD</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
          <p className="mt-2 text-sm text-muted-foreground">Visão geral de todos os cursos a distância da plataforma.</p>
        </div>
        <Link to="/admin/trilhas-gestao">
          <Button className="gap-2 bg-gradient-nexti text-primary-foreground hover:opacity-90">
            <BookOpen className="h-4 w-4" /> Gerenciar Trilhas
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Trilhas", value: stats.total, color: "text-primary" },
          { label: "Ativas", value: stats.active, color: "text-green-600" },
          { label: "Total Aulas", value: stats.lessons, color: "text-accent" },
          { label: "Matrículas", value: stats.enrollments, color: "text-primary" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-surface p-4">
            <p className="font-display text-2xl font-bold text-foreground tabular-nums">{stat.value.toLocaleString("pt-BR")}</p>
            <p className={`text-xs font-medium ${stat.color}`}>{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="mt-5 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar trilha ou categoria..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Table */}
      <div className="mt-4 card-surface overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : tracks.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhum curso encontrado.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/50">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Curso</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Categoria</th>
                <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Aulas</th>
                <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Horas Est.</th>
                <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((t) => (
                <tr key={t.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                        <Video className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{t.title}</p>
                        {t.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{t.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {t.category ? <Badge variant="secondary" className="text-[10px]">{t.category}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-5 py-4 text-center text-sm tabular-nums text-foreground">{t.lessons?.length || 0}</td>
                  <td className="px-5 py-4 text-center text-sm tabular-nums text-muted-foreground">{t.estimated_hours || 0}h</td>
                  <td className="px-5 py-4 text-center">
                    <Badge variant={t.is_active ? "default" : "destructive"} className="text-[10px]">
                      {t.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminCursosEad;
