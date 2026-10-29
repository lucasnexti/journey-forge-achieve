import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldAlert, ShieldX, Search } from "lucide-react";

type Result = {
  found: boolean; valid?: boolean; revoked?: boolean; revoked_at?: string; code?: string; course?: string;
  hours?: number | null; completed_at?: string; issued_at?: string; student?: string; institution?: string;
};

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "—");

const VerifyCertificatePage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(code || "");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) { setResult(null); return; }
    setLoading(true);
    // A validade é sempre consultada no registro oficial, nunca deduzida da URL.
    supabase.rpc("verify_certificate", { _code: code }).then(({ data, error }) => {
      setResult(error ? { found: false } : ((data as Result) || { found: false }));
      setLoading(false);
    });
  }, [code]);

  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium sm:text-right">{value || "—"}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="card-surface w-full max-w-lg p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Nexti Academy</p>
          <h1 className="font-display text-2xl font-bold">Validação de Certificado</h1>
          <p className="text-sm text-muted-foreground">Confira a autenticidade pelo QR Code ou pelo código impresso no certificado.</p>
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (input.trim()) navigate(`/validar-certificado/${encodeURIComponent(input.trim())}`); }}>
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Código do certificado" aria-label="Código do certificado" />
          <Button type="submit" className="gap-1"><Search className="h-4 w-4" /> Validar</Button>
        </form>
        {loading && <p className="text-sm text-muted-foreground">Consultando registro oficial…</p>}
        {!loading && result && (result.found && result.valid ? (
          <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-success text-base mb-2"><CheckCircle2 className="h-5 w-5" /> Certificado válido</p>
            <Row label="Aluno" value={result.student} />
            <Row label="Curso" value={result.course} />
            {result.hours ? <Row label="Carga horária" value={`${Number(result.hours).toLocaleString("pt-BR")} ${Number(result.hours) === 1 ? "hora" : "horas"}`} /> : null}
            <Row label="Data de conclusão" value={fmt(result.completed_at)} />
            <Row label="Data de emissão" value={fmt(result.issued_at)} />
            <Row label="Identificador" value={result.code} />
          </div>
        ) : result.found && result.revoked ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm space-y-2">
            <p className="flex items-center gap-2 font-semibold text-destructive text-base"><ShieldX className="h-5 w-5" /> Certificado revogado</p>
            <p className="text-muted-foreground">Este certificado foi revogado pela Nexti Academy em {fmt(result.revoked_at)} e não é mais válido.</p>
            <Row label="Curso" value={result.course} />
            <Row label="Identificador" value={result.code} />
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-destructive text-base"><ShieldAlert className="h-5 w-5" /> Certificado não encontrado ou inválido</p>
            <p className="mt-1 text-muted-foreground">Este código não corresponde a um certificado emitido pela Nexti Academy.</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VerifyCertificatePage;
