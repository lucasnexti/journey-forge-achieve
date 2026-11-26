import { describe, expect, it } from "vitest";
import { answerPercent, packSurveyAnswers, surveyMetadataSchema } from "./surveyBuilder";
import { validateQuestion, type QuestionDraft } from "./research";
describe("construtor de pesquisas",()=>{
  it("comentário pertence só à pergunta habilitada e não substitui nota zero",()=>{
    expect(packSurveyAnswers({a:0,b:10},{a:" Comentário "})).toEqual({a:{value:0,comment:"Comentário"},b:10});
  });
  it("comentário opcional sem resposta permanece separado",()=>expect(packSurveyAnswers({},{a:"Sugestão"})).toEqual({a:{value:null,comment:"Sugestão"}}));
  it("múltipla escolha pode somar mais que 100% usando respondentes",()=>{
    expect(answerPercent(2,2)).toBe(100); expect(answerPercent(1,2)).toBe(50); expect(answerPercent(0,0)).toBeNull();
  });
  const q:QuestionDraft={type:"scale",prompt:"Conteúdo",required:true,indicator:null,options:[],scale_min:0,scale_max:10,min_label:"",max_label:""};
  it("escala numérica permite 0–10",()=>expect(validateQuestion(q)).toBeNull());
  it("estrelas aceitam apenas 1–5",()=>{
    expect(validateQuestion({...q,scale_display:"stars"})).not.toBeNull();
    expect(validateQuestion({...q,scale_display:"stars",scale_min:1,scale_max:5})).toBeNull();
  });
  it("satisfação aceita apenas 1–5",()=>{
    expect(validateQuestion({...q,scale_display:"satisfaction"})).not.toBeNull();
    expect(validateQuestion({...q,scale_display:"satisfaction",scale_min:1,scale_max:5})).toBeNull();
  });
  it("alternativas duplicadas são rejeitadas",()=>expect(validateQuestion({...q,type:"single",options:["Bom"," Bom "]})).not.toBeNull());
  it("escala fracionária é rejeitada",()=>expect(validateQuestion({...q,scale_min:0.5})).not.toBeNull());
  it("agradecimento obrigatório e limitado",()=>{
    const m={title:"Pesquisa",presentation:"",thank_you:"Obrigado!",anonymous:true,training_date:null};
    expect(surveyMetadataSchema.safeParse(m).success).toBe(true);
    expect(surveyMetadataSchema.safeParse({...m,thank_you:""}).success).toBe(false);
    expect(surveyMetadataSchema.safeParse({...m,thank_you:"a".repeat(1001)}).success).toBe(false);
  });
});