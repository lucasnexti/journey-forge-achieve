import { useState } from "react";
import Header from "@/components/Header";
import { FileText, ExternalLink, Search, ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

type KBArticle = { label: string; href: string };
type KBSection = { title: string; articles: KBArticle[] };

const sections: KBSection[] = [
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
  { title: "DASHBOARD", articles: [
    { label: "Guia Dashboard Completo", href: "https://nexti.octadesk.com/kb/article/guia-dashboard-completo" },
  ]},
  { title: "NEXTI ANALYTICS", articles: [
    { label: "Guia Rápido — Nexti Analytics", href: "https://nexti.octadesk.com/kb/article/nexti-analytics" },
  ]},
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
  { title: "NEXTI TALENT — RECRUTAMENTO E SELEÇÃO", articles: [
    { label: "Guia Admissão Digital", href: "https://docs.google.com/presentation/d/1CedC-mG5uSfrbz80_q-QSYCT0O0BXjmO/edit" },
  ]},
];

const totalArticles = sections.reduce((sum, s) => sum + s.articles.length, 0);

const KnowledgeBasePage = () => {
  const [search, setSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const filteredSections = search.trim()
    ? sections
        .map((s) => ({
          ...s,
          articles: s.articles.filter(
            (a) =>
              a.label.toLowerCase().includes(search.toLowerCase()) ||
              s.title.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((s) => s.articles.length > 0)
    : sections;

  const isSearching = search.trim().length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent py-10">
        <div className="container text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-nexti shadow-lg shadow-primary/20 mb-4">
            <BookOpen className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
            Base de Conhecimento
          </h1>
          <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
            Manuais, guias e documentações do sistema Nexti — {sections.length} categorias · {totalArticles} artigos
          </p>

          {/* Search */}
          <div className="relative mt-6 max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar artigo ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container py-8 max-w-4xl">
        {filteredSections.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="mx-auto h-10 w-10 mb-3 opacity-40" />
            <p>Nenhum resultado encontrado para "{search}"</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSections.map((section) => {
              const isOpen = isSearching || expandedSections.has(section.title);
              return (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-surface overflow-hidden"
                >
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between p-4 text-left group hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                        <p className="text-xs text-muted-foreground">{section.articles.length} artigo{section.articles.length !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border px-4 py-2">
                          {section.articles.map((article) => (
                            <a
                              key={article.label}
                              href={article.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-2 py-2.5 rounded-md hover:bg-muted/50 transition-colors group/link"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover/link:text-primary transition-colors" />
                              <span className="text-sm text-foreground group-hover/link:text-primary transition-colors">
                                {article.label}
                              </span>
                            </a>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default KnowledgeBasePage;
