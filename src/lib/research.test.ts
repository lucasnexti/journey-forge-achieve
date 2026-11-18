import { describe, expect, it } from "vitest";
import {
  autoMapColumns, classifyNps, csatFromScores, csatPercent, deadlineDate, detectHeaderRow, diffBase, effectiveStatus, extractListRows,
  isValidEmail, LIST_FIELDS, npsFromScores, npsScore, parseSheetDate, participationRate, reachPercent, showValue, summarizeRows,
  validateListRows, validateQuestion, templateQuestions, type ListField,
} from "./research";

describe("NPS", () => {
  it("classifica 9 e 10 como promotores, 7 e 8 como neutros e 0 a 6 como detratores", () => {
    expect([10, 9].map(classifyNps)).toEqual(["promoter", "promoter"]);
    expect([8, 7].map(classifyNps)).toEqual(["passive", "passive"]);
    expect([6, 0].map(classifyNps)).toEqual(["detractor", "detractor"]);
  });
  it("calcula % promotores − % detratores em pontos", () => {
    // 5 promotores, 3 neutros, 2 detratores → 50% − 20% = 30
    expect(npsFromScores([10, 9, 9, 10, 9, 8, 7, 7, 6, 3])).toBe(30);
  });
  it("fica entre −100 e 100", () => {
    expect(npsFromScores([0, 1, 2])).toBe(-100);
    expect(npsFromScores([9, 10])).toBe(100);
  });
  it("sem respostas mostra Sem dados, nunca zero", () => {
    expect(npsScore(0, 0, 0)).toBeNull();
    expect(showValue(npsScore(0, 0, 0))).toBe("Sem dados");
  });
  it("consolida pelas respostas válidas, sem média simples entre pesquisas", () => {
    // Pesquisa A: 1 resposta 10 (NPS 100). Pesquisa B: 9 respostas 0 (NPS −100). Média simples daria 0.
    expect(npsFromScores([10, ...Array(9).fill(0)])).toBe(-80);
  });
});

describe("CSAT", () => {
  it("considera notas 4 e 5 sobre o total de respostas válidas", () => {
    expect(csatFromScores([5, 4, 3, 2])).toBe(50);
    expect(csatPercent(3, 4)).toBe(75);
  });
  it("sem respostas mostra Sem dados", () => {
    expect(csatPercent(0, 0)).toBeNull();
  });
});

describe("participação e alcance", () => {
  it("participação = respondidos ÷ enviados com sucesso × 100", () => {
    expect(participationRate(3, 12)).toBe(25);
    expect(participationRate(0, 0)).toBeNull();
  });
  it("alcance = ativos que participaram ÷ ativos da base × 100; base vazia é insuficiente", () => {
    expect(reachPercent(40, 200)).toBe(20);
    expect(reachPercent(5, 0)).toBeNull();
  });
});

describe("prazo", () => {
  it("padrão de sete dias termina no fim do sétimo dia no horário de São Paulo", () => {
    // 01:00 UTC de 10/03 ainda é 09/03 em São Paulo
    expect(deadlineDate(7, new Date("2026-03-10T01:00:00Z"))).toBe("2026-03-16");
  });
  it("pesquisa em andamento com prazo vencido aparece como encerrada", () => {
    expect(effectiveStatus("active", "2026-01-01T00:00:00Z", new Date("2026-01-02T00:00:00Z"))).toBe("closed");
    expect(effectiveStatus("active", "2026-01-03T00:00:00Z", new Date("2026-01-02T00:00:00Z"))).toBe("active");
  });
});

describe("importação de listas", () => {
  it("valida e-mails", () => {
    expect(isValidEmail("ana.souza@nexti.com")).toBe(true);
    expect(isValidEmail("ana@@nexti.com")).toBe(false);
    expect(isValidEmail("ana@nexti")).toBe(false);
    expect(isValidEmail("ana..b@nexti.com")).toBe(false);
  });
  it("entende datas do Excel, dd/mm/aaaa e do relatório do Teams", () => {
    expect(parseSheetDate("15/10/2024")).toBe("2024-10-15");
    expect(parseSheetDate("2024-10-15")).toBe("2024-10-15");
    expect(parseSheetDate("10/15/24, 2:03:11 PM")).toBe("2024-10-15");
    expect(parseSheetDate(45580)).toBe("2024-10-15");
    expect(parseSheetDate("31/02/2024")).toBeNull();
  });
  it("encontra o cabeçalho depois do resumo do Teams e associa as colunas", () => {
    const rows = [["1. Resumo"], ["Título da reunião", "Onboarding"], [], ["Nome", "Primeira entrada", "Última saída", "Email", "Função"], ["Ana", "15/10/2024", "x", "ana@nexti.com", "Participante"]];
    const header = detectHeaderRow(rows);
    expect(header).toBe(3);
    const map = autoMapColumns(rows[header], LIST_FIELDS.map((f) => f.value));
    expect(map.name).toBe(0);
    expect(map.email).toBe(3);
    expect(map.training_date).toBe(1);
  });
  it("consolida entradas repetidas da mesma pessoa na mesma sessão, mas não em sessões diferentes", () => {
    const data = [["Nome", "Email", "Data"], ["Ana", "ANA@nexti.com ", "15/10/2024"], ["Ana", "ana@nexti.com", "15/10/2024"], ["Ana", "ana@nexti.com", "16/10/2024"]];
    const map = autoMapColumns(data[0], LIST_FIELDS.map((f) => f.value)) as Record<ListField, number | null>;
    const rows = validateListRows(extractListRows(data, map, 0), { company: "", training_name: "Onboarding", training_date: null }, true);
    expect(rows.map((r) => r.issue)).toEqual([null, "duplicate", null]);
    expect(summarizeRows(rows)).toMatchObject({ valid: 2, duplicates: 1 });
  });
  it("lista de presença exige treinamento e data; lista de destinatários não", () => {
    const rows = [{ line: 2, name: "Ana", email: "ana@nexti.com", area: "", company: "", training_name: "", training_date: null, issue: null, excluded: false }];
    expect(validateListRows(rows, { company: "", training_name: "", training_date: null }, true)[0].issue).toBe("missing_training");
    expect(validateListRows(rows, { company: "", training_name: "", training_date: null }, false)[0].issue).toBeNull();
  });
  it("identifica registros sem e-mail e e-mails inválidos", () => {
    const base = { line: 2, name: "Ana", area: "", company: "", training_name: "T", training_date: "2024-10-15", issue: null, excluded: false };
    const rows = validateListRows([{ ...base, email: "" }, { ...base, email: "ana@" }], { company: "", training_name: "", training_date: null }, true);
    expect(rows.map((r) => r.issue)).toEqual(["no_email", "invalid_email"]);
  });
  it("registros excluídos pelo administrador não entram nem contam como duplicidade", () => {
    const base = { line: 2, name: "Ana", email: "ana@nexti.com", area: "", company: "", training_name: "T", training_date: "2024-10-15", issue: null };
    const rows = validateListRows([{ ...base, excluded: true }, { ...base, excluded: false }], { company: "", training_name: "", training_date: null }, true);
    expect(rows[1].issue).toBeNull();
    expect(summarizeRows(rows)).toMatchObject({ valid: 1, excluded: 1 });
  });
});

describe("base de colaboradores", () => {
  it("não inativa automaticamente quem ficou fora da nova planilha", () => {
    const prev = [{ external_id: "", name: "Ana", email: "ana@nexti.com", area: "RH", company: "Nexti", active: true }, { external_id: "", name: "Bia", email: "bia@nexti.com", area: "TI", company: "Nexti", active: true }];
    const next = [{ external_id: "", name: "Ana", email: "ana@nexti.com", area: "Financeiro", company: "Nexti", active: true }, { external_id: "", name: "Caio", email: "caio@nexti.com", area: "TI", company: "Nexti", active: true }];
    const d = diffBase(prev, next);
    expect(d.added.map((r) => r.name)).toEqual(["Caio"]);
    expect(d.changed.map((c) => c.after.area)).toEqual(["Financeiro"]);
    expect(d.absent.map((r) => r.name)).toEqual(["Bia"]);
    expect(d.absent[0].active).toBe(true);
  });
});

describe("perguntas", () => {
  it("modelos NPS (0 a 10) e CSAT (1 a 5) usam as escalas corretas", () => {
    const nps = templateQuestions("nps")[0];
    const csat = templateQuestions("csat")[0];
    expect([nps.indicator, nps.scale_min, nps.scale_max]).toEqual(["nps", 0, 10]);
    expect([csat.indicator, csat.scale_min, csat.scale_max]).toEqual(["csat", 1, 5]);
    expect(templateQuestions("nps")[1]).toMatchObject({ prompt: "Qual é o principal motivo da sua nota?", required: false });
  });
  it("escolhas exigem ao menos duas opções diferentes", () => {
    const q = { type: "single" as const, indicator: null, prompt: "Formato?", required: true, options: ["Online", "Online"], scale_min: null, scale_max: null, min_label: "", max_label: "" };
    expect(validateQuestion(q)).not.toBeNull();
    expect(validateQuestion({ ...q, options: ["Online", "Presencial"] })).toBeNull();
  });
});
