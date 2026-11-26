import { useQuery } from "@tanstack/react-query";
import { FileDown, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { downloadWorkbook } from "@/lib/spreadsheet";
import { answerPercent, type SurveyResults as Results } from "@/lib/surveyBuilder";
import { npsScore, csatPercent } from "@/lib/research";
import { toast } from "sonner";

const number = (v: number | null) => v === null ? "Sem dados" : v.toLocaleString("pt-BR",{maximumFractionDigits:2});
export default function SurveyResults({ surveyId }: { surveyId: string }) {
  const query = useQuery({ queryKey:["research-builder-results",surveyId], queryFn:async()=>{
    const {data,error}=await supabase.rpc("research_builder_results",{_survey:surveyId}); if(error) throw error; return data as unknown as Results;
  }});
  const d=query.data;
  const exportExcel = () => {
    if(!d) return;
    downloadWorkbook("resultados-pesquisa.xlsx",[
      {name:"Resumo",rows:[{Pesquisa:d.title,Identificação:d.anonymous ? "Anônima" : "Identificada",Convidados:d.invited,Respondentes:d.respondents}]},
      {name:"Perguntas",rows:d.questions.map(q=>({Pergunta:q.prompt,"Respostas válidas":q.n,Média:q.avg}))},
      {name:"Alternativas",rows:d.questions.flatMap(q=>(q.distribution ?? []).map(o=>({Pergunta:q.prompt,Alternativa:o.label,Respostas:o.count,"Percentual (%)":answerPercent(o.count,q.n)})))},
      {name:"Comentários",rows:d.questions.flatMap(q=>q.comments.map(c=>({Pergunta:q.prompt,Resposta:c.text ?? "","Comentário adicional":c.additional ?? "",...(d.identified ? {Nome:c.name ?? "","E-mail":c.email ?? ""} : {})})))},
    ]);
  };
  const exportPdf=async()=>{
    if(!d) return;
    try {
      const {jsPDF}=await import("jspdf"); const doc=new jsPDF(); let y=20;
      const line=(text:string,size=10)=>{doc.setFontSize(size); for(const s of doc.splitTextToSize(text,175)){if(y>275){doc.addPage();y=20;}doc.text(s,18,y);y+=6;}y+=2;};
      line(d.title,16); line(`${d.anonymous ? "Anônima" : "Identificada"} | Convidados: ${d.invited} | Respondentes: ${d.respondents}`);
      d.questions.forEach(q=>{line(q.prompt,12);line(`Respostas válidas: ${q.n} | Média: ${number(q.avg)}`);(q.distribution ?? []).forEach(o=>line(`${o.label}: ${o.count} (${number(answerPercent(o.count,q.n))}%)`)); q.comments.forEach(c=>{if(d.identified && c.name) line(`${c.name} ${c.email ?? ""}`);if(c.text) line(c.text);if(c.additional) line(`Comentário adicional: ${c.additional}`);});});
      doc.save("resultados-pesquisa.pdf");
    } catch {toast.error("Não foi possível exportar o PDF.");}
  };
  if(query.isLoading) return <p role="status">Calculando resultados…</p>;
  if(query.isError) return <p role="alert" className="text-destructive">Não foi possível consultar os resultados ou sua conta não tem permissão.</p>;
  if(!d) return null;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm"><strong>{d.respondents}</strong> respondentes únicos · <strong>{d.invited}</strong> convidados · {d.anonymous ? "Anônima" : "Identificada"}</p><div className="flex flex-wrap gap-2"><Button variant="ghost" size="icon" aria-label="Atualizar resultados" onClick={()=>query.refetch()}><RefreshCw className="h-4 w-4" /></Button><Button variant="outline" onClick={exportExcel}><FileDown />Excel</Button><Button variant="outline" onClick={exportPdf}><FileDown />PDF</Button></div></div>
    {!d.respondents && <p className="text-sm text-muted-foreground">Nenhuma resposta recebida.</p>}
    {d.questions.map((q,i)=>{
      const dist=q.distribution ?? [];
      const nps=q.indicator==="nps" ? npsScore(dist.filter(o=>Number(o.label)>=9).reduce((s,o)=>s+o.count,0),dist.filter(o=>Number(o.label)<=6).reduce((s,o)=>s+o.count,0),q.n) : null;
      const csat=q.indicator==="csat" ? csatPercent(dist.filter(o=>Number(o.label)>=4).reduce((s,o)=>s+o.count,0),q.n) : null;
      return <section key={q.id} className="space-y-3 border-t border-border pt-4"><h3 className="font-semibold">{i+1}. {q.prompt}</h3><p className="text-sm text-muted-foreground">{q.n} respostas válidas{q.type==="scale" && ` · Média: ${number(q.avg)}`}{q.indicator==="nps" && ` · NPS: ${number(nps)}`}{q.indicator==="csat" && ` · CSAT: ${number(csat)}%`}</p>
        {q.type==="multiple" && <p className="text-xs text-muted-foreground">Percentual por respondente da pergunta; a soma pode superar 100%.</p>}
        {!!dist.length && <><div className="h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={dist}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="label" tick={{fontSize:11,fill:"hsl(var(--muted-foreground))"}} /><YAxis allowDecimals={false} tick={{fill:"hsl(var(--muted-foreground))"}} /><Tooltip /><Bar dataKey="count" name="Respostas" fill="hsl(var(--primary))" isAnimationActive={false} /></BarChart></ResponsiveContainer></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-muted-foreground"><tr><th className="py-2">Alternativa / nota</th><th>Respostas</th><th>Percentual</th></tr></thead><tbody>{dist.map(o=><tr key={o.label} className="border-t border-border"><td className="py-2">{o.label}</td><td>{o.count}</td><td>{number(answerPercent(o.count,q.n))}{q.n>0 ? "%" : ""}</td></tr>)}</tbody></table></div></>}
        {q.comments.length>0 && <ul className="divide-y divide-border">{q.comments.map((c,j)=><li key={j} className="space-y-1 py-3 text-sm">{d.identified && c.name && <p className="font-medium">{c.name} · {c.email}</p>}{c.text && <p className="whitespace-pre-wrap">{c.text}</p>}{c.additional && <p className="whitespace-pre-wrap"><span className="text-muted-foreground">Comentário adicional: </span>{c.additional}</p>}</li>)}</ul>}
      </section>;
    })}
  </div>;
}