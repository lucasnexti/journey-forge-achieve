import { useState, useEffect, useMemo } from "react";
import {
  Star, Plus, Users, MessageSquare,
  ToggleLeft, ToggleRight, Trash2, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from "recharts";

interface Survey {
  id: string;
  title: string;
  type: "csat";
  trigger_type: string;
  question: string;
  is_active: boolean;
  created_at: string;
}

interface SurveyResponse {
  id: string;
  survey_id: string;
  user_id: string;
  score: number;
  comment: string | null;
  created_at: string;
}

const CSAT_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];
const CSAT_LABELS = ["Muito insatisfeito", "Insatisfeito", "Neutro", "Satisfeito", "Muito satisfeito"];

const AdminAvaliacoes = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);

  const [form, setForm] = useState({ title: "", question: "" });

  const fetchData = async () => {
    setLoading(true);
    const [{ data: s }, { data: r }, { data: p }] = await Promise.all([
      supabase.from("surveys").select("*").eq("type", "csat").order("created_at", { ascending: false }),
      supabase.from("survey_responses").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, nome"),
    ]);
    setSurveys((s || []) as Survey[]);
    setResponses((r || []) as SurveyResponse[]);
    const profileMap: Record<string, string> = {};
    (p || []).forEach((pr: any) => { profileMap[pr.user_id] = pr.nome; });
    setProfiles(profileMap);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // CSAT Metrics
  const csatMetrics = useMemo(() => {
    const csatSurveyIds = surveys.map(s => s.id);
    const csatResponses = responses.filter(r => csatSurveyIds.includes(r.survey_id));
    if (!csatResponses.length) return { score: 0, total: 0, distribution: [0, 0, 0, 0, 0] };
    const avg = csatResponses.reduce((acc, r) => acc + r.score, 0) / csatResponses.length;
    const distribution = [1, 2, 3, 4, 5].map(s => csatResponses.filter(r => r.score === s).length);
    return { score: Math.round(avg * 10) / 10, total: csatResponses.length, distribution };
  }, [surveys, responses]);

  const csatDistribution = useMemo(() => {
    return [1, 2, 3, 4, 5].map((s, i) => ({
      stars: `${s}★`,
      count: csatMetrics.distribution[i],
      fill: CSAT_COLORS[i],
    }));
  }, [csatMetrics]);

  const csatResponses = useMemo(() => {
    const csatSurveyIds = surveys.map(s => s.id);
    return responses.filter(r => csatSurveyIds.includes(r.survey_id));
  }, [surveys, responses]);

  const handleCreate = async () => {
    if (!form.title || !form.question) { toast.error("Preencha todos os campos."); return; }
    const { error } = await supabase.from("surveys").insert({
      title: form.title,
      type: "csat",
      trigger_type: "track_completion",
      question: form.question,
      is_active: true,
    });
    if (error) { toast.error("Erro ao criar pesquisa."); return; }
    toast.success("Pesquisa CSAT criada! Será exibida ao final de cada trilha.");
    setShowCreate(false);
    setForm({ title: "", question: "" });
    fetchData();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("surveys").update({ is_active: !current }).eq("id", id);
    toast.success(current ? "Pesquisa desativada" : "Pesquisa ativada");
    fetchData();
  };

  const deleteSurvey = async (id: string) => {
    await supabase.from("surveys").delete().eq("id", id);
    toast.success("Pesquisa excluída");
    fetchData();
  };

  const selectedResponses = selectedSurvey ? csatResponses.filter(r => r.survey_id === selectedSurvey) : [];
  const selectedSurveyData = surveys.find(s => s.id === selectedSurvey);

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Avaliações CSAT</h1>
            <p className="text-muted-foreground text-sm">Acompanhe a satisfação dos alunos ao final de cada trilha</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />Nova Pesquisa
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">CSAT Médio</p>
                  <p className="text-3xl font-bold text-foreground">{csatMetrics.score}<span className="text-lg text-muted-foreground">/5</span></p>
                </div>
                <Star className="w-8 h-8 text-yellow-400 fill-yellow-400 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{csatMetrics.total} avaliações</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Respostas</p>
                  <p className="text-3xl font-bold text-foreground">{csatResponses.length}</p>
                </div>
                <Users className="w-8 h-8 text-primary opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{surveys.length} pesquisas criadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Comentários</p>
                  <p className="text-3xl font-bold text-foreground">{csatResponses.filter(r => r.comment).length}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-primary opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{Math.round((csatResponses.filter(r => r.comment).length / Math.max(csatResponses.length, 1)) * 100)}% deixaram feedback</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="surveys">Pesquisas</TabsTrigger>
            <TabsTrigger value="responses">Respostas</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* CSAT Distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Distribuição CSAT</CardTitle>
                </CardHeader>
                <CardContent>
                  {csatMetrics.total > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={csatDistribution}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="stars" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="count" name="Respostas" radius={[4, 4, 0, 0]}>
                          {csatDistribution.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Nenhuma resposta CSAT ainda</div>
                  )}
                </CardContent>
              </Card>

              {/* Recent comments */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Comentários Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[220px]">
                    {csatResponses.filter(r => r.comment).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum comentário ainda</p>
                    ) : (
                      <div className="space-y-3">
                        {csatResponses.filter(r => r.comment).slice(0, 10).map(r => {
                          const survey = surveys.find(s => s.id === r.survey_id);
                          return (
                            <div key={r.id} className="border-b border-border pb-2 last:border-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium">{profiles[r.user_id] || "Usuário"}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {r.score}★
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{r.comment}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Surveys Management */}
          <TabsContent value="surveys" className="space-y-4">
            {surveys.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma pesquisa criada ainda.</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {surveys.map(s => {
                  const surveyResponses = csatResponses.filter(r => r.survey_id === s.id);
                  return (
                    <Card key={s.id}>
                      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-sm">{s.title}</h3>
                            <Badge variant="secondary">CSAT</Badge>
                            <Badge variant="outline">Conclusão de Trilha</Badge>
                            {!s.is_active && <Badge variant="destructive" className="text-[10px]">Inativa</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{s.question}</p>
                          <p className="text-xs text-muted-foreground mt-1">{surveyResponses.length} respostas</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedSurvey(s.id)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleActive(s.id, s.is_active)}>
                            {s.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteSurvey(s.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Responses */}
          <TabsContent value="responses" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <ScrollArea className="h-[500px]">
                  {csatResponses.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma resposta ainda</p>
                  ) : (
                    <div className="space-y-2">
                      {csatResponses.map(r => {
                        const survey = surveys.find(s => s.id === r.survey_id);
                        return (
                          <div key={r.id} className="flex items-center gap-4 p-3 rounded-lg border border-border">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{profiles[r.user_id] || "Usuário"}</span>
                                <Badge variant="outline" className="text-[10px]">{survey?.title}</Badge>
                              </div>
                              {r.comment && <p className="text-xs text-muted-foreground mt-1 truncate">{r.comment}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-lg font-bold ${
                                r.score >= 4 ? "text-green-600" : r.score >= 3 ? "text-yellow-600" : "text-red-600"
                              }`}>
                                {r.score}★
                              </span>
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Survey Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Pesquisa CSAT</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Satisfação Trilha Q1 2026" />
              </div>
              <div>
                <Label>Pergunta</Label>
                <Textarea value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} placeholder="Como você avalia sua experiência com esta trilha?" />
              </div>
              <p className="text-xs text-muted-foreground">
                A pesquisa CSAT será exibida automaticamente quando o aluno concluir uma trilha.
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Criar Pesquisa</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Responses Dialog */}
        <Dialog open={!!selectedSurvey} onOpenChange={() => setSelectedSurvey(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedSurveyData?.title} — Respostas</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              {selectedResponses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma resposta</p>
              ) : (
                <div className="space-y-3">
                  {selectedResponses.map(r => (
                    <div key={r.id} className="border-b border-border pb-3 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{profiles[r.user_id] || "Usuário"}</span>
                        <span className="text-lg font-bold">{r.score}★</span>
                      </div>
                      {r.comment && <p className="text-xs text-muted-foreground mt-1">{r.comment}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminAvaliacoes;
