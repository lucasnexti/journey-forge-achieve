import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { FileText, ExternalLink, Loader2, BookOpen } from "lucide-react";
import { playbookSupabase } from "@/lib/playbookClient";

type KBArticle = { label: string; href: string };
type KBSection = { title: string; articles: KBArticle[] };

// Fallback hardcoded data — used only if the live fetch fails
const fallbackSections: KBSection[] = [
  { title: "APRESENTAÇÃO NEXTI", articles: [{ label: "Apresentação Nexti", href: "https://nexti.octadesk.com/kb/article/apresentacao-nexti" }] },
  { title: "AJUSTE DE PONTO COLABORADOR", articles: [{ label: "Solicitação Ajuste ponto Colaborador", href: "https://nexti.octadesk.com/kb/article/solicitacao-ajuste-ponto-colaborador" }] },
  { title: "CADASTROS", articles: [
    { label: "Tipos de usuário", href: "https://nexti.octadesk.com/kb/article/tipos-de-usuario" },
    { label: "Cadastro Sanção Disciplinar", href: "https://nexti.octadesk.com/kb/article/cadastro-sancao-disciplinar" },
    { label: "Cadastro Biometria e Senha Completo", href: "https://nexti.octadesk.com/kb/article/guia-cadastro-biometria-e-senha-completo" },
    { label: "Cadastro Horário e Escala Completo", href: "https://nexti.octadesk.com/kb/article/guia-cadastro-horario-e-escala-completo" },
  ]},
  { title: "NEXTI DOC", articles: [{ label: "Nexti Docs", href: "https://nexti.octadesk.com/kb/article/nexti-docs" }] },
  { title: "NEXTI CONTROL", articles: [{ label: "Manual Control V1", href: "https://nexti.octadesk.com/kb/article/manual-control-v1" }] },
  { title: "NEXTI PLUS", articles: [
    { label: "Guia Nexti Plus Completo", href: "https://nexti.octadesk.com/kb/article/guia-nexti-plus-completo" },
    { label: "Vale Combustível", href: "https://nexti.octadesk.com/kb/article/vale-combustivel" },
    { label: "Gratificação", href: "https://nexti.octadesk.com/kb/article/gratificacao" },
    { label: "Vale Transporte", href: "https://nexti.octadesk.com/kb/article/vale-transporte" },
    { label: "VR VA VC", href: "https://nexti.octadesk.com/kb/article/vr-va-vc" },
  ]},
  { title: "NEXTI TIME", articles: [
    { label: "Guia Nexti Time Completo", href: "https://nexti.octadesk.com/kb/article/guia-nexti-time-completo" },
    { label: "Perfil de apuração completo", href: "https://nexti.octadesk.com/kb/article/perfil-de-apuracao-completo" },
    { label: "Perfil de apuração: Hora extra e exportação FOPAG", href: "https://nexti.octadesk.com/kb/article/perfil-de-apuracao-hora-extra-e-exportacao-fopag" },
    { label: "Perfil de apuração: Ausências e horistas", href: "https://nexti.octadesk.com/kb/article/perfil-de-apuracao-ausencias-e-horistas" },
    { label: "Perfil de apuração: Adc not, banco de horas e DSR", href: "https://nexti.octadesk.com/kb/article/perfil-de-apuracao-adc-not-banco-de-horas-e-dsr" },
    { label: "Perfil de apuração, período, lançamento manual e gestão", href: "https://nexti.octadesk.com/kb/article/perfil-de-apuracao-periodo-de-apuracao-lancamento-manual-e-gestao-de-apuracao" },
  ]},
  { title: "RH DIGITAL", articles: [
    { label: "Guia RH Digital Completo", href: "https://nexti.octadesk.com/kb/article/guia-rh-digital-completo" },
    { label: "Guia Rápido Nexti Direct", href: "https://nexti.octadesk.com/kb/article/guia-rapido-nexti-direct" },
    { label: "Guia Avisos e Convocações", href: "https://nexti.octadesk.com/kb/article/guia-avisos-e-convocacoes" },
    { label: "Guia Checklist", href: "https://nexti.octadesk.com/kb/article/guia-checklist" },
  ]},
  { title: "DASHBOARD", articles: [{ label: "Guia Dashboard Completo", href: "https://nexti.octadesk.com/kb/article/guia-dashboard-completo" }] },
  { title: "NEXTI ANALYTICS", articles: [{ label: "Guia Rápido — Nexti Analytics", href: "https://nexti.octadesk.com/kb/article/nexti-analytics" }] },
  { title: "TERMINAIS", articles: [
    { label: "Guia Cadastro Terminal e Vincular Biometria", href: "https://nexti.octadesk.com/kb/article/guia-cadastro-terminal-e-vincular-biometria" },
    { label: "Manual Configuração APN", href: "https://nexti.octadesk.com/kb/article/manual-configuracao-apn" },
    { label: "Manual Configuração WIFI", href: "https://nexti.octadesk.com/kb/article/manual-configuracao-wifi" },
    { label: "Manual Sincronização via Bluetooth", href: "https://nexti.octadesk.com/kb/article/manual-sincronizacao-via-bluetooth" },
    { label: "Manual de Fixação dos Terminais", href: "https://nexti.octadesk.com/kb/article/manual-de-fixacao-dos-terminais" },
    { label: "Resolvendo Problemas nos Terminais", href: "https://nexti.octadesk.com/kb/article/resolvendo-problemas-nos-terminais" },
  ]},
  { title: "APLICATIVO", articles: [{ label: "Guia Aplicativo Colaborador", href: "https://nexti.octadesk.com/kb/article/guia-aplicativo-colaborador" }] },
  { title: "NEXTI PRIME", articles: [
    { label: "Requisição de operação", href: "https://nexti.octadesk.com/kb/article/req" },
    { label: "Mesa de operação completo", href: "https://nexti.octadesk.com/kb/article/mesa-de-operacao-completo" },
    { label: "Cadastro e lançamento de ausência", href: "https://nexti.octadesk.com/kb/article/cadastro-e-lancamento-de-ausencia" },
    { label: "Gestão de Trocas e Coberturas", href: "https://nexti.octadesk.com/kb/article/gestao-de-trocas-e-coberturas" },
    { label: "Ajuste de inconsistências em lote", href: "https://nexti.octadesk.com/kb/article/ajuste-de-inconsistencias-em-lote" },
    { label: "Inconsistências", href: "https://nexti.octadesk.com/kb/article/inconsistencias" },
  ]},
  { title: "FACIAL", articles: [
    { label: "Cadastro de Facial", href: "https://nexti.octadesk.com/kb/article/cadastro-de-facial" },
    { label: "Guia — Reconhecimento Facial", href: "https://nexti.octadesk.com/kb/article/guia-reconhecimento-facial" },
  ]},
  { title: "ESCOPO INICIAL DE INTEGRAÇÃO", articles: [{ label: "Escopo Inicial de Integração", href: "https://nexti.octadesk.com/kb/article/escopo-inicial-de-integracao" }] },
  { title: "NEXTI CLUB", articles: [{ label: "Manual Nexti Club", href: "https://nexti.octadesk.com/kb/article/nexti-club" }] },
  { title: "NEXTI TALENT — RECRUTAMENTO E SELEÇÃO", articles: [
    { label: "Guia Admissão Digital", href: "https://docs.google.com/presentation/d/1CedC-mG5uSfrbz80_q-QSYCT0O0BXjmO/edit" },
  ]},
  { title: "DATA LAKE", articles: [{ label: "DataLake", href: "https://nexti.octadesk.com/kb/article/datalake" }] },
];

const KnowledgeBasePage = () => {
  const [sections, setSections] = useState<KBSection[]>(fallbackSections);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKB = async () => {
      try {
        const { data: secs, error: secErr } = await playbookSupabase
          .from("kb_sections")
          .select("id, title, sort_order")
          .order("sort_order");

        if (secErr || !secs || secs.length === 0) {
          setLoading(false);
          return;
        }

        const { data: arts, error: artErr } = await playbookSupabase
          .from("kb_articles")
          .select("section_id, label, href, sort_order")
          .order("sort_order");

        if (artErr || !arts) {
          setLoading(false);
          return;
        }

        const articlesBySection = new Map<string, KBArticle[]>();
        for (const a of arts) {
          if (!articlesBySection.has(a.section_id)) articlesBySection.set(a.section_id, []);
          articlesBySection.get(a.section_id)!.push({ label: a.label, href: a.href });
        }

        const result = secs.map((s: any) => ({
          title: s.title,
          articles: articlesBySection.get(s.id) || [],
        }));

        if (result.length > 0) setSections(result);
      } catch {
        // fallback stays
      } finally {
        setLoading(false);
      }
    };
    fetchKB();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero — same style as Playbook */}
      <section className="bg-muted/50 border-b border-border py-10">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Base de Conhecimento</h1>
          <p className="text-muted-foreground">Manuais, guias e documentações do sistema Nexti</p>
        </div>
      </section>

      {/* Content — masonry 2 columns like Playbook */}
      <main className="max-w-6xl mx-auto px-4 py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="columns-1 md:columns-2 gap-6 space-y-6">
            {sections.map((section) => (
              <div key={section.title} className="border border-border rounded-lg overflow-hidden break-inside-avoid">
                <div className="bg-muted/60 px-5 py-3 border-b border-border">
                  <h2 className="text-sm font-bold text-foreground tracking-wide uppercase">
                    {section.title}
                  </h2>
                </div>
                <div className="divide-y divide-border">
                  {section.articles.map((article) => (
                    <a
                      key={article.href}
                      href={article.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-5 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors group"
                    >
                      <FileText className="w-4 h-4 shrink-0 text-primary/60" />
                      <span className="flex-1">{article.label}</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default KnowledgeBasePage;
