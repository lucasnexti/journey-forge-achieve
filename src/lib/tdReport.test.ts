import { describe, expect, it } from "vitest";
import { TD_INDICATORS, tdCoverage, tdNps, tdRatio, tdRows, tdStatus, validTDPeriod, type TDReportData } from "./tdReport";
describe("T&D — metas e faixas sem arredondamento", () => {
  it.each([
    ["execution",95,80], ["trained",90,75], ["presence",85,70], ["completion",80,60],
    ["hours",8,4], ["coverage",90,70], ["nps",75,50], ["content",4.5,4], ["mandatory",100,90],
  ])("%s: verde e amarelo nos limites exatos", (id, target, yellow) => {
    const rule = TD_INDICATORS.find(i => i.id === id);
    expect(rule?.target).toBe(target); expect(rule?.yellow).toBe(yellow);
    expect(tdStatus(Number(target), Number(target), Number(yellow))).toBe("Verde");
    expect(tdStatus(Number(target)-0.001, Number(target), Number(yellow))).toBe("Amarelo");
    expect(tdStatus(Number(yellow), Number(target), Number(yellow))).toBe("Amarelo");
    expect(tdStatus(Number(yellow)-0.001, Number(target), Number(yellow))).toBe("Vermelho");
  });
  it("preserva zero válido, mas não divide por zero", () => {
    expect(tdRatio(0, 10)).toBe(0); expect(tdRatio(1, 0)).toBeNull();
    expect(tdStatus(0,80,60)).toBe("Vermelho"); expect(tdStatus(null,80,60)).toBe("Sem dados");
  });
  it("NPS inclui neutros no denominador e aceita resultado negativo", () => {
    expect(tdNps(2,1,4)).toBe(25); expect(tdNps(0,1,4)).toBe(-25);
  });
  it("horas usa horas dos participantes por ativos, não percentual", () => expect(tdRatio(80,10,1)).toBe(8));
  it("cobertura geral conta áreas com pelo menos 70%, excluindo denominador zero", () => {
    expect(tdCoverage([{trained:7,active:10},{trained:6,active:10},{trained:0,active:0}])).toBe(50);
  });
  const base: TDReportData = { company:"Nexti",tracks:[],areas:[],base_count:0,presence_count:0,quality:[],completion:[{month:"2026-11-01",enrolled:10,completed:8}] };
  it("conclusão usa os mesmos inscritos e não transforma ausência em zero", () => {
    const rows = tdRows(base,"2026-11-01","2026-11-30",null);
    expect(rows.find(r=>r.indicator.id==="completion")?.value).toBe(80);
    expect(rows.find(r=>r.indicator.id==="trained")?.value).toBeNull();
  });
  it("área sem vínculo validado não reutiliza conclusão geral", () => {
    const row = tdRows(base,"2026-11-01","2026-11-30","RH").find(r=>r.indicator.id==="completion");
    expect(row?.value).toBeNull(); expect(row?.status).toBe("A validar");
  });
  it("comentários não são convertidos em nota de conteúdo", () => {
    const rows = tdRows({...base,quality:[{survey_id:"1",title:"Pesquisa",training:"Curso",nps_total:0,promoters:0,detractors:0,content_total:0,content_mean:null}]},"2026-11-01","2026-11-30",null);
    expect(rows.find(r=>r.indicator.id==="content")?.status).toBe("A validar");
  });
  it("não interpreta acesso ou matrícula como obrigação", () => {
    expect(tdRows(base,"2026-11-01","2026-11-30",null).find(r=>r.indicator.id==="mandatory")?.value).toBeNull();
  });
  it("rejeita períodos invertidos e superiores a três anos", () => {
    expect(validTDPeriod("2026-11-30","2026-11-01")).toBe(false);
    expect(validTDPeriod("2020-01-01","2026-01-01")).toBe(false);
    expect(validTDPeriod("2026-11-01","2026-11-30")).toBe(true);
  });
});