export type TDStatus = "Verde" | "Amarelo" | "Vermelho" | "Sem dados" | "A validar";
export const TD_INDICATORS = [
  { id: "execution", pillar: "Execução", name: "Treinamentos realizados x planejados", cadence: "Mensal", target: 95, yellow: 80, unit: "%" },
  { id: "trained", pillar: "Adesão", name: "Colaboradores treinados", cadence: "Mensal", target: 90, yellow: 75, unit: "%" },
  { id: "presence", pillar: "Adesão", name: "Taxa de presença", cadence: "Mensal", target: 85, yellow: 70, unit: "%" },
  { id: "completion", pillar: "Adesão", name: "Taxa de conclusão", cadence: "Mensal", target: 80, yellow: 60, unit: "%" },
  { id: "hours", pillar: "Desenvolvimento", name: "Horas de treinamento por colaborador", cadence: "Trimestral", target: 8, yellow: 4, unit: " h" },
  { id: "coverage", pillar: "Alcance", name: "Cobertura por área", cadence: "Trimestral", target: 90, yellow: 70, unit: "%" },
  { id: "nps", pillar: "Qualidade", name: "NPS dos treinamentos", cadence: "Após cada treinamento", target: 75, yellow: 50, unit: " pontos" },
  { id: "content", pillar: "Qualidade", name: "Avaliação média do conteúdo", cadence: "Após cada treinamento", target: 4.5, yellow: 4, unit: " / 5" },
  { id: "mandatory", pillar: "Compliance", name: "Treinamentos obrigatórios concluídos", cadence: "Mensal", target: 100, yellow: 90, unit: "%" },
] as const;
export type TDIndicator = typeof TD_INDICATORS[number];
export function tdStatus(value: number | null, target: number, yellow: number): TDStatus {
  if (value === null || !Number.isFinite(value)) return "Sem dados";
  return value >= target ? "Verde" : value >= yellow ? "Amarelo" : "Vermelho";
}
export function tdRatio(numerator: number, denominator: number, multiplier = 100): number | null {
  return denominator > 0 ? numerator / denominator * multiplier : null;
}
export function tdNps(promoters: number, detractors: number, total: number) {
  return tdRatio(promoters - detractors, total);
}
export function tdCoverage(areas: { trained: number; active: number }[]) {
  const eligible = areas.filter(a => a.active > 0);
  return tdRatio(eligible.filter(a => a.trained / a.active >= 0.7).length, eligible.length);
}
export interface TDReportData {
  company: string;
  tracks: { id: string; title: string }[];
  areas: string[];
  base_count: number;
  presence_count: number;
  completion: { month: string; enrolled: number; completed: number }[];
  quality: { survey_id: string; title: string; training: string; nps_total: number; promoters: number; detractors: number; content_total: number; content_mean: number | null }[];
}
export interface TDRow {
  key: string; indicator: TDIndicator; period: string; value: number | null;
  status: TDStatus; reason: string; source: string; detail?: string;
}
export function tdRows(data: TDReportData, start: string, end: string, area: string | null): TDRow[] {
  const rows: TDRow[] = [];
  const months = data.completion.map(c => c.month);
  const quarters = [...new Set(months.map(m => `${Math.ceil(Number(m.slice(5, 7)) / 3)}º trimestre / ${m.slice(0, 4)}`))];
  for (const indicator of TD_INDICATORS) {
    const periods = indicator.cadence === "Trimestral" ? quarters : indicator.cadence === "Mensal" ? months : ["Período selecionado"];
    if ((indicator.id === "nps" || indicator.id === "content") && data.quality.length) {
      for (const q of data.quality) {
        const value = indicator.id === "nps" ? tdNps(q.promoters, q.detractors, q.nps_total) : q.content_mean;
        rows.push({ key: `${indicator.id}-${q.survey_id}`, indicator, period: "Após o treinamento", value,
          status: indicator.id === "content" && !q.content_total ? "A validar" : tdStatus(value, indicator.target, indicator.yellow),
          reason: value === null ? indicator.id === "content" ? "Falta pergunta numérica de conteúdo na escala de 1 a 5; comentários e satisfação geral não substituem a nota." : "Sem respostas NPS válidas (0 a 10)." : "",
          source: "Pesquisas internas vinculadas ao curso", detail: `${q.training} · ${q.title}` });
      }
      continue;
    }
    for (const period of periods) {
      let value: number | null = null;
      let status: TDStatus = "Sem dados";
      let reason = "";
      let source = "";
      switch (indicator.id) {
        case "execution": source = "Ações Internas / Google Agenda · pendente"; reason = "Falta planejamento e registro de realização. O importador atual de presença não importa ações planejadas."; break;
        case "trained": source = "Academy + presença + base de ativos"; status = "A validar"; reason = "Validar com Daniela se presença ou conclusão define colaborador treinado e qual base de ativos vale no mês."; break;
        case "presence": source = "Meet / listas de presença + inscrições"; reason = `Há ${data.presence_count} registro(s) de presença no recorte. Falta vincular presença e inscrição à mesma sessão; uma matrícula EAD não comprova inscrição no Meet.`; break;
        case "completion": {
          source = "Academy · matrículas e conclusões";
          const c = data.completion.find(c => c.month === period);
          if (area) { status = "A validar"; reason = "Falta vínculo validado entre colaborador da Academy, área e versão da base de ativos."; }
          else {
            value = c ? tdRatio(c.completed, c.enrolled) : null;
            status = tdStatus(value, indicator.target, indicator.yellow);
            reason = c?.enrolled ? `${c.completed} conclusão(ões) / ${c.enrolled} inscrição(ões). Mesma base de inscritos no mês, com conclusão até o fim do recorte.` : "Nenhuma inscrição no período (denominador zero).";
          }
          break;
        }
        case "hours": source = "Academy · duração + base de ativos"; status = "A validar"; reason = "Daniela deve validar horas efetivamente assistidas ou carga cadastrada, repetição de cursos e data de referência dos ativos."; break;
        case "coverage": source = "Academy + presença + base de ativos"; status = "A validar"; reason = "Validar critério de treinado e base de referência. Cobertura de cada área: treinados únicos / ativos. Geral: áreas com ≥ 70% / áreas elegíveis."; break;
        case "nps": source = "Feedz / pesquisas internas vinculadas · pendente"; reason = "Sem notas 0 a 10 vinculadas ao ID do curso. O importador existente não importa respostas da Feedz."; break;
        case "content": source = "Feedz / pesquisa numérica de conteúdo · pendente"; reason = "Falta pergunta de conteúdo com nota de 1 a 5. Comentários não permitem calcular a média."; break;
        case "mandatory": source = "Academy · atribuições obrigatórias · pendente"; status = "A validar"; reason = "Falta vínculo explícito colaborador–treinamento obrigatório e validação de Daniela para o recorte mensal. Matrícula ou acesso à trilha não significa obrigação."; break;
      }
      if ((indicator.id === "trained" || indicator.id === "coverage") && !data.base_count) { status = "Sem dados"; reason = `Base de colaboradores ativos não importada. ${reason}`; }
      rows.push({ key: `${indicator.id}-${period}`, indicator, period, value, status, reason, source });
      if (indicator.id === "coverage") {
        for (const name of area ? [area] : data.areas) rows.push({ key: `area-${name}-${period}`, indicator, period, value: null, status: "A validar", reason: "Percentual da área depende da base de ativos e do critério de treinado validados.", source, detail: `Área: ${name}` });
      }
    }
  }
  return rows;
}
export function validTDPeriod(start: string, end: string) {
  const a = Date.parse(start); const b = Date.parse(end);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a && b - a <= 1096 * 86400000;
}