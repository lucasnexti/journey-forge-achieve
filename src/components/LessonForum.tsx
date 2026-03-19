import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageSquare, Send, Reply } from "lucide-react";

interface LessonForumProps {
  lessonId: string;
  trackId: string;
}

interface Post {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  profile_name?: string;
}

const LessonForum = ({ lessonId, trackId }: LessonForumProps) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newContent, setNewContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, [lessonId]);

  const loadPosts = async () => {
    // Use track_id to filter forum posts related to this lesson context
    const { data } = await supabase
      .from("forum_posts")
      .select("id, user_id, title, content, created_at, parent_id")
      .eq("track_id", trackId)
      .order("created_at", { ascending: true });

    // Fetch profile names
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", userIds);

      const nameMap = new Map(profiles?.map((p) => [p.user_id, p.nome]) || []);
      setPosts(data.map((p) => ({ ...p, profile_name: nameMap.get(p.user_id) || "Usuário" })));
    } else {
      setPosts([]);
    }
    setLoading(false);
  };

  const handlePost = async () => {
    if (!user || !newContent.trim()) return;
    await supabase.from("forum_posts").insert({
      user_id: user.id,
      track_id: trackId,
      title: `Discussão - Aula`,
      content: newContent.trim(),
    });
    setNewContent("");
    toast.success("Comentário publicado!");
    loadPosts();
  };

  const handleReply = async (parentId: string) => {
    if (!user || !replyContent.trim()) return;
    await supabase.from("forum_posts").insert({
      user_id: user.id,
      track_id: trackId,
      title: "Resposta",
      content: replyContent.trim(),
      parent_id: parentId,
    });
    setReplyContent("");
    setReplyTo(null);
    toast.success("Resposta publicada!");
    loadPosts();
  };

  const rootPosts = posts.filter((p) => !p.parent_id);
  const replies = (parentId: string) => posts.filter((p) => p.parent_id === parentId);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h4 className="font-display text-sm font-semibold text-foreground">Discussão</h4>
        <span className="text-xs text-muted-foreground">({rootPosts.length})</span>
      </div>

      {/* New post */}
      <div className="flex gap-2 mb-4">
        <Textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Faça uma pergunta ou comentário..."
          rows={2}
          className="resize-none text-sm flex-1"
        />
        <Button onClick={handlePost} size="sm" disabled={!newContent.trim()} className="self-end">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Posts */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {loading ? (
          <p className="text-center text-xs text-muted-foreground py-4">Carregando...</p>
        ) : rootPosts.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">Nenhum comentário ainda. Seja o primeiro!</p>
        ) : (
          rootPosts.map((post) => (
            <div key={post.id} className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{post.profile_name}</span>
                <span className="text-[10px] text-muted-foreground">{timeAgo(post.created_at)}</span>
              </div>
              <p className="mt-1 text-sm text-foreground">{post.content}</p>

              <button
                onClick={() => setReplyTo(replyTo === post.id ? null : post.id)}
                className="mt-2 flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <Reply className="h-3 w-3" /> Responder
              </button>

              {/* Replies */}
              {replies(post.id).map((r) => (
                <div key={r.id} className="ml-4 mt-2 rounded-lg bg-secondary/50 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-foreground">{r.profile_name}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-foreground">{r.content}</p>
                </div>
              ))}

              {/* Reply form */}
              {replyTo === post.id && (
                <div className="ml-4 mt-2 flex gap-2">
                  <Textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Escreva sua resposta..."
                    rows={1}
                    className="resize-none text-xs flex-1"
                  />
                  <Button onClick={() => handleReply(post.id)} size="sm" disabled={!replyContent.trim()}>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LessonForum;
