import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldAlert, Search } from "lucide-react";

type Result = { found: boolean; valid?: boolean; code?: string; course?: string; issued_at?: string; student?: string; institution?: string };

const VerifyCertificatePage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(code || "");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    supabase.rpc("verify_certificate", { _code: code }).then(({ data }) => {
      setResult((data as Result) || { found: false });
      setLoading(false);
    });
  }, [code]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="card-surface w-full max-w-md p-6 space-y-5">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Verificar certificado</h1>
          <p className="text-sm text-muted-foreground">Nexti Academy — consulte a autenticidade pelo código impresso no certificado.</p>
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (input.trim()) navigate(`/verificar/${encodeURIComponent(input.trim())}`); }}>
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Código do certificado" />
          <Button type="submit" className="gap-1"><Search className="h-4 w-4" /> Verificar</Button>
        </form>
        {loading && <p className="text-sm text-muted-foreground">Consultando…</p>}
        {!loading && result && (result.found && result.valid ? (
          <div className="rounded-lg border border-success/40 bg-success/10 p-4 space-y-1 text-sm">
            <p className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Certificado válido</p>
            <p><span className="text-muted-foreground">Aluno:</span> {result.student}</p>
            <p><span className="text-muted-foreground">Curso:</span> {result.course}</p>
            <p><span className="text-muted-foreground">Emitido em:</span> {result.issued_at && new Date(result.issued_at).toLocaleDateString("pt-BR")}</p>
            <p><span className="text-muted-foreground">Instituição:</span> {result.institution}</p>
            <p className="font-mono text-xs text-muted-foreground">Código: {result.code}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-destructive"><ShieldAlert className="h-4 w-4" />
              {result.found ? "Certificado revogado" : "Certificado não encontrado"}</p>
            <p className="mt-1 text-muted-foreground">Este código não corresponde a um certificado válido emitido pela Nexti Academy.</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VerifyCertificatePage;
