import { useState, useEffect, useMemo } from "react";
import {
  BarChart3, Plus, Star, TrendingUp, TrendingDown, Users, MessageSquare,
  ToggleLeft, ToggleRight, Trash2, Eye, ThumbsUp, ThumbsDown, Minus, Send
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";

interface Survey {
  id: string;
  title: string;
  type: "nps" | "csat";
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

const TRIGGER_LABELS: Record<string, string> = {
  track_completion: "Conclusão de Trilha",
  login_milestone: "Marco de Login",
  periodic: "Periódica",
  manual: "Manual",
};

const NPS_COLORS = { detractors: "#ef4444", passives: "#eab308", promoters: "#22c55e" };
const CSAT_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

const AdminAvaliacoes = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({ title: "", type: "nps" as "nps" | "csat", question: "" });

  const fetchData = async () => {
    setLoading(true);
    const [{ data: s }, { data: r }, { data: p }] = await Promise.all([
      supabase.from("surveys").select("*").order("created_at", { ascending: false }),
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

  // NPS Metrics
  const npsMetrics = useMemo(() => {
    const npsSurveyIds = surveys.filter(s => s.type === "nps").map(s => s.id);
    const npsResponses = responses.filter(r => npsSurveyIds.includes(r.survey_id));
    if (!npsResponses.length) return { score: 0, promoters: 0, passives: 0, detractors: 0, total: 0 };
    const promoters = npsResponses.filter(r => r.score >= 9).length;
    const passives = npsResponses.filter(r => r.score >= 7 && r.score <= 8).length;
    const detractors = npsResponses.filter(r => r.score <= 6).length;
    const total = npsResponses.length;
    const score = Math.round(((promoters - detractors) / total) * 100);
    return { score, promoters, passives, detractors, total };
  }, [surveys, responses]);

  // CSAT Metrics
  const csatMetrics = useMemo(() => {
    const csatSurveyIds = surveys.filter(s => s.type === "csat").map(s => s.id);
    const csatResponses = responses.filter(r => csatSurveyIds.includes(r.survey_id));
    if (!csatResponses.length) return { score: 0, total: 0, distribution: [0, 0, 0, 0, 0] };
    const avg = csatResponses.reduce((acc, r) => acc + r.score, 0) / csatResponses.length;
    const distribution = [1, 2, 3, 4, 5].map(s => csatResponses.filter(r => r.score === s).length);
    return { score: Math.round(avg * 10) / 10, total: csatResponses.length, distribution };
  }, [surveys, responses]);

  // NPS distribution chart data
  const npsDistribution = useMemo(() => {
    const npsSurveyIds = surveys.filter(s => s.type === "nps").map(s => s.id);
    const npsResponses = responses.filter(r => npsSurveyIds.includes(r.survey_id));
    return Array.from({ length: 11 }, (_, i) => ({
      score: i.toString(),
      count: npsResponses.filter(r => r.score === i).length,
      fill: i <= 6 ? NPS_COLORS.detractors : i <= 8 ? NPS_COLORS.passives : NPS_COLORS.promoters,
    }));
  }, [surveys, responses]);

  // CSAT star chart data
  const csatDistribution = useMemo(() => {
    return [1, 2, 3, 4, 5].map((s, i) => ({
      stars: `${s}★`,
      count: csatMetrics.distribution[i],
      fill: CSAT_COLORS[i],
    }));
  }, [csatMetrics]);

  // NPS Pie data
  const npsPieData = [
    { name: "Promotores", value: npsMetrics.promoters, color: NPS_COLORS.promoters },
    { name: "Passivos", value: npsMetrics.passives, color: NPS_COLORS.passives },
    { name: "Detratores", value: npsMetrics.detractors, color: NPS_COLORS.detractors },
  ].filter(d => d.value > 0);

  const handleCreate = async () => {
    if (!form.title || !form.question) { toast.error("Preencha todos os campos."); return; }
    const isNps = form.type === "nps";
    const { error } = await supabase.from("surveys").insert({
      title: form.title,
      type: form.type,
      trigger_type: isNps ? "manual" : "track_completion",
      question: form.question,
      is_active: isNps ? false : true, // NPS starts inactive until admin sends it
    });
    if (error) { toast.error("Erro ao criar pesquisa."); return; }
    toast.success(isNps ? "Pesquisa NPS criada! Use o botão 'Enviar' para disparar aos alunos." : "Pesquisa CSAT criada! Será exibida ao final de cada trilha.");
    setShowCreate(false);
    setForm({ title: "", type: "nps", question: "" });
    fetchData();
  };

  const sendNpsSurvey = async (id: string) => {
    await supabase.from("surveys").update({ is_active: true }).eq("id", id);
    toast.success("Pesquisa NPS enviada para os alunos!");
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

  const selectedResponses = selectedSurvey ? responses.filter(r => r.survey_id === selectedSurvey) : [];
  const selectedSurveyData = surveys.find(s => s.id === selectedSurvey);

  const getNPSBadge = (score: number) => {
    if (score >= 50) return <Badge className="bg-green-500/10 text-green-600 border-green-200">Excelente</Badge>;
    if (score >= 0) return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">Bom</Badge>;
    return <Badge className="bg-red-500/10 text-red-600 border-red-200">Crítico</Badge>;
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Avaliações NPS / CSAT</h1>
            <p className="text-muted-foreground text-sm">Acompanhe a satisfação dos alunos com pesquisas automatizadas</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />Nova Pesquisa
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">NPS Score</p>
                  <p className={`text-3xl font-bold ${npsMetrics.score >= 50 ? "text-green-600" : npsMetrics.score >= 0 ? "text-yellow-600" : "text-red-600"}`}>
                    {npsMetrics.score}
                  </p>
                </div>
                {npsMetrics.score >= 0 ? <TrendingUp className="w-8 h-8 text-green-500 opacity-50" /> : <TrendingDown className="w-8 h-8 text-red-500 opacity-50" />}
              </div>
              <div className="mt-2">{getNPSBadge(npsMetrics.score)}</div>
            </CardContent>
          </Card>
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
                  <p className="text-3xl font-bold text-foreground">{responses.length}</p>
                </div>
                <Users className="w-8 h-8 text-primary opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{surveys.length} pesquisas ativas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Comentários</p>
                  <p className="text-3xl font-bold text-foreground">{responses.filter(r => r.comment).length}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-primary opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{Math.round((responses.filter(r => r.comment).length / Math.max(responses.length, 1)) * 100)}% deixaram feedback</p>
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
              {/* NPS Distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Distribuição NPS</CardTitle>
                </CardHeader>
                <CardContent>
                  {npsMetrics.total > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={npsDistribution}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="score" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="count" name="Respostas" radius={[4, 4, 0, 0]}>
                          {npsDistribution.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Nenhuma resposta NPS ainda</div>
                  )}
                  {npsMetrics.total > 0 && (
                    <div className="flex justify-center gap-6 mt-2 text-xs">
                      <span className="flex items-center gap-1"><ThumbsDown className="w-3 h-3 text-red-500" />Detratores: {npsMetrics.detractors}</span>
                      <span className="flex items-center gap-1"><Minus className="w-3 h-3 text-yellow-500" />Passivos: {npsMetrics.passives}</span>
                      <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3 text-green-500" />Promotores: {npsMetrics.promoters}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

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

              {/* NPS Pie */}
              {npsMetrics.total > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Composição NPS</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={npsPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {npsPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Recent comments */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Comentários Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[220px]">
                    {responses.filter(r => r.comment).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum comentário ainda</p>
                    ) : (
                      <div className="space-y-3">
                        {responses.filter(r => r.comment).slice(0, 10).map(r => {
                          const survey = surveys.find(s => s.id === r.survey_id);
                          return (
                            <div key={r.id} className="border-b border-border pb-2 last:border-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium">{profiles[r.user_id] || "Usuário"}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {survey?.type === "nps" ? `NPS: ${r.score}` : `${r.score}★`}
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
                  const surveyResponses = responses.filter(r => r.survey_id === s.id);
                  return (
                    <Card key={s.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-sm">{s.title}</h3>
                            <Badge variant={s.type === "nps" ? "default" : "secondary"}>
                              {s.type.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">{TRIGGER_LABELS[s.trigger_type]}</Badge>
                            {!s.is_active && <Badge variant="destructive" className="text-[10px]">Inativa</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{s.question}</p>
                          <p className="text-xs text-muted-foreground mt-1">{surveyResponses.length} respostas</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedSurvey(s.id)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {s.type === "nps" && !s.is_active && (
                            <Button size="sm" variant="default" onClick={() => sendNpsSurvey(s.id)} className="gap-1 text-xs">
                              <Send className="w-3 h-3" /> Enviar
                            </Button>
                          )}
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
                  {responses.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma resposta ainda</p>
                  ) : (
                    <div className="space-y-2">
                      {responses.map(r => {
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
                                survey?.type === "nps"
                                  ? r.score >= 9 ? "text-green-600" : r.score >= 7 ? "text-yellow-600" : "text-red-600"
                                  : r.score >= 4 ? "text-green-600" : r.score >= 3 ? "text-yellow-600" : "text-red-600"
                              }`}>
                                {survey?.type === "nps" ? r.score : `${r.score}★`}
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
              <DialogTitle>Nova Pesquisa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: NPS Q1 2026" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as "nps" | "csat" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nps">NPS (0-10) — Envio manual</SelectItem>
                    <SelectItem value="csat">CSAT (1-5 ★) — Ao final de cada trilha</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {form.type === "nps"
                    ? "A pesquisa NPS será criada inativa. Use o botão 'Enviar' para dispará-la aos alunos."
                    : "A pesquisa CSAT será exibida automaticamente quando o aluno concluir uma trilha."}
                </p>
              </div>
              <div>
                <Label>Pergunta</Label>
                <Textarea value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} placeholder="Em uma escala de 0 a 10..." />
              </div>
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
                        <span className="text-lg font-bold">
                          {selectedSurveyData?.type === "nps" ? r.score : `${r.score}★`}
                        </span>
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
