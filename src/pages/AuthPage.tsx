import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, BookOpen, Award, Users, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const AuthPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cargo, setCargo] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    } else {
      toast.success("Login realizado com sucesso!");
      navigate("/dashboard");
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Informe seu nome."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nome, cpf, empresa, cargo }, emailRedirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
    else toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] bg-gradient-nexti relative flex-col justify-between p-10 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>
          <div className="mt-8">
            <span className="font-display text-4xl font-extrabold italic text-primary-foreground">nexti</span>
            <p className="mt-1 text-sm font-medium uppercase tracking-widest text-primary-foreground/60">Universidade Corporativa</p>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="font-display text-3xl font-bold text-primary-foreground leading-tight">
              Desenvolva competências que fazem a diferença
            </h2>
            <p className="mt-4 max-w-md text-base text-primary-foreground/70 leading-relaxed">
              Acesse trilhas de aprendizado, conquiste certificados e acompanhe seu progresso em uma plataforma moderna e completa.
            </p>
          </motion.div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: BookOpen, label: "50+ Cursos", desc: "Conteúdo atualizado" },
              { icon: Award, label: "Certificados", desc: "Validação digital" },
              { icon: Users, label: "500+ Alunos", desc: "Comunidade ativa" },
            ].map(({ icon: Icon, label, desc }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="rounded-xl bg-primary-foreground/10 backdrop-blur-sm p-4 border border-primary-foreground/10"
              >
                <Icon className="h-5 w-5 text-primary-foreground/80" />
                <p className="mt-2 text-sm font-semibold text-primary-foreground">{label}</p>
                <p className="text-xs text-primary-foreground/60">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/40">
          © {new Date().getFullYear()} Nexti. Todos os direitos reservados.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col bg-background">
        <div className="flex items-center justify-between p-4 lg:p-6">
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-nexti">
              <span className="font-display text-sm font-extrabold text-primary-foreground">N</span>
            </div>
            <span className="font-display text-lg font-bold text-foreground">Nexti</span>
          </Link>
          <div className="hidden lg:block" />
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin ? "Não tem conta? " : "Já tem conta? "}
            <span className="font-semibold text-primary">{isLogin ? "Cadastre-se" : "Entre"}</span>
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-8">
          <motion.div
            key={isLogin ? "login" : "signup"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            <div className="mb-8">
              <h1 className="font-display text-2xl font-bold text-foreground">
                {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {isLogin
                  ? "Entre com suas credenciais para continuar aprendendo."
                  : "Preencha seus dados para começar sua jornada."}
              </p>
            </div>

            <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="nome" className="text-sm font-medium">Nome completo *</Label>
                    <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cpf" className="text-sm font-medium">CPF</Label>
                    <Input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="empresa" className="text-sm font-medium">Empresa</Label>
                      <Input id="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da empresa" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cargo" className="text-sm font-medium">Cargo</Label>
                      <Input id="cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Seu cargo" />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">E-mail *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">Senha *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isLogin && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!email.trim()) { toast.error("Informe seu e-mail primeiro."); return; }
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) toast.error(error.message);
                    else toast.success("Link de recuperação enviado para seu e-mail!");
                  }}
                  className="w-full text-right text-xs text-primary hover:underline"
                >
                  Esqueci minha senha
                </button>
              )}

              <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-nexti text-primary-foreground hover:opacity-90 font-semibold">
                {loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar Conta"}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Ao continuar, você concorda com nossos termos de uso e política de privacidade.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
