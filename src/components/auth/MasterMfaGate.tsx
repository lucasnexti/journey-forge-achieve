import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { status: "checking" } | { status: "ok" } | { status: "challenge"; factorId: string } | { status: "enroll"; factorId: string; qr: string; secret: string };

/** Usuários Master só entram após a verificação em duas etapas (aplicativo autenticador). */
const MasterMfaGate = ({ children }: { children: React.ReactNode }) => {
  const { isMaster, loading } = useIsAdmin();
  const qc = useQueryClient();
  const [state, setState] = useState<State>({ status: "checking" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isMaster) { setState({ status: "ok" }); return; }
    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") { setState({ status: "ok" }); return; }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find((f) => f.status === "verified");
      if (verified) { setState({ status: "challenge", factorId: verified.id }); return; }
      for (const f of factors?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Nexti Academy" });
      if (error || !data) { toast.error("Não foi possível iniciar a verificação em duas etapas."); return; }
      setState({ status: "enroll", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, [isMaster, loading]);

  if (state.status === "ok") return <>{children}</>;
  if (state.status === "checking") {
    return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: state.factorId, code: code.trim() });
    setBusy(false);
    if (error) { toast.error("Código inválido. Confira o código no aplicativo e tente novamente."); return; }
    await qc.invalidateQueries();
    setState({ status: "ok" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form onSubmit={verify} className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /><h1 className="text-lg font-semibold">Verificação em duas etapas</h1></div>
        {state.status === "enroll" ? (
          <>
            <p className="text-sm text-muted-foreground">Seu perfil Master exige verificação em duas etapas. Escaneie o QR Code com um aplicativo autenticador (Google Authenticator, Microsoft Authenticator…) e digite o código de 6 dígitos.</p>
            <img src={state.qr} alt="QR Code para o aplicativo autenticador" className="mx-auto h-44 w-44 rounded bg-white p-2" />
            <p className="break-all text-center text-xs text-muted-foreground">Ou digite a chave: <span className="font-mono">{state.secret}</span></p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="mfa-code">Código</Label>
          <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        </div>
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy ? "Verificando..." : "Verificar e entrar"}</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => supabase.auth.signOut()}>Sair</Button>
      </form>
    </div>
  );
};
export default MasterMfaGate;
