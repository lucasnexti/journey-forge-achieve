import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, MessageSquare, Trash2, User } from "lucide-react";

const AdminForumGestao = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [postsRes, profilesRes, tracksRes] = await Promise.all([
      supabase.from("forum_posts").select("*").is("parent_id", null).order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, nome"),
      supabase.from("tracks").select("id, title"),
    ]);
    if (postsRes.data) setPosts(postsRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (tracksRes.data) setTracks(tracksRes.data);
    setLoading(false);
  };

  const getUserName = (uid: string) => profiles.find(p => p.user_id === uid)?.nome || "Anônimo";
  const getTrackName = (tid: string | null) => tid ? tracks.find(t => t.id === tid)?.title || "" : "Geral";

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este post e suas respostas?")) return;
    await supabase.from("forum_posts").delete().eq("id", id);
    toast.success("Post excluído."); fetchAll();
  };

  const filtered = posts.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.content.toLowerCase().includes(search.toLowerCase()) ||
    getUserName(p.user_id).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <h1 className="font-display text-xl font-bold text-primary">Fórum / Mural</h1>
      <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
      <p className="mt-2 text-sm text-muted-foreground">Moderação de posts e discussões da plataforma.</p>

      <div className="mt-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar posts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="mt-6 space-y-2">
        {loading ? (
          <div className="card-surface p-12 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : filtered.length === 0 ? (
          <div className="card-surface p-12 text-center text-sm text-muted-foreground">Nenhum post encontrado.</div>
        ) : (
          filtered.map(post => (
            <div key={post.id} className="card-surface p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{getTrackName(post.track_id)}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{post.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {getUserName(post.user_id)}</span>
                    <span className="tabular-nums">{new Date(post.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(post.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminForumGestao;
