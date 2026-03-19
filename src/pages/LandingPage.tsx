import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Play, BookOpen, Users, Award, Clock, ShieldCheck,
  Layers, MessageCircle, RefreshCw, ArrowRight, CheckCircle2, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-universidade.jpg";

const stats = [
  { value: "500+", label: "Alunos ativos" },
  { value: "50+", label: "Cursos disponíveis" },
  { value: "95%", label: "Taxa de satisfação" },
  { value: "1.200+", label: "Certificados emitidos" },
];

const features = [
  {
    icon: Play,
    title: "Videoaulas de Alta Qualidade",
    description: "Conteúdo gravado por especialistas com capturas de tela, narração e animações.",
  },
  {
    icon: Layers,
    title: "Trilhas Estruturadas",
    description: "Cursos organizados em trilhas de aprendizado com progressão lógica.",
  },
  {
    icon: Award,
    title: "Certificação Digital",
    description: "Certificados com código de validação emitidos automaticamente após conclusão.",
  },
  {
    icon: Clock,
    title: "Aprenda no Seu Ritmo",
    description: "Disponível 24/7 em qualquer dispositivo. Pause e retome quando quiser.",
  },
  {
    icon: MessageCircle,
    title: "Fórum de Discussão",
    description: "Tire dúvidas e interaja com colegas e instrutores em cada aula.",
  },
  {
    icon: ShieldCheck,
    title: "Ambiente Seguro",
    description: "Acesso controlado com autenticação e rastreamento completo de progresso.",
  },
];

const benefits = [
  "Cursos EAD e blended-learning",
  "Operação assistida presencial",
  "Gamificação com badges e ranking",
  "Relatórios de progresso por empresa",
  "Quizzes e avaliações automatizadas",
  "Materiais complementares por aula",
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b border-border/30 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-nexti">
              <span className="font-display text-sm font-extrabold text-primary-foreground">N</span>
            </div>
            <span className="font-display text-xl font-extrabold text-foreground">
              Universidade <span className="text-gradient-nexti">Nexti</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Entrar
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-gradient-nexti text-primary-foreground hover:opacity-90 gap-1.5">
                Começar agora
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative grid grid-cols-1 items-center gap-12 py-20 lg:grid-cols-2 lg:py-32">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
              <Star className="h-3 w-3 fill-primary" />
              Plataforma LMS Corporativa
            </div>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight text-foreground lg:text-5xl xl:text-6xl">
              Capacite sua equipe com a{" "}
              <span className="text-gradient-nexti">Universidade Nexti</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Trilhas de aprendizado estruturadas, videoaulas de alta qualidade e certificação digital. 
              Tudo que sua organização precisa para desenvolver talentos.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-start gap-4">
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-nexti text-primary-foreground hover:opacity-90 gap-2 text-base px-8 h-12 shadow-lg shadow-primary/20">
                  <Play className="h-4 w-4" />
                  Acessar Plataforma
                </Button>
              </Link>
              <a href="#sobre" className="inline-flex items-center gap-2 px-6 h-12 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Saiba mais
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-primary/10">
              <img
                src={heroImage}
                alt="Profissionais estudando juntos em um laptop"
                className="w-full object-cover aspect-[4/3]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent" />
            </div>
            {/* Floating card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="absolute -bottom-6 -left-6 hidden lg:flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-xl"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">+1.200 certificados</p>
                <p className="text-xs text-muted-foreground">emitidos este ano</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/50 bg-secondary/30">
        <div className="container grid grid-cols-2 gap-6 py-12 sm:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="text-center"
            >
              <p className="font-display text-3xl font-extrabold text-gradient-nexti">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Sobre */}
      <section id="sobre" className="scroll-mt-20">
        <div className="container py-20 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Sobre o Projeto</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-foreground lg:text-4xl">
                Uma universidade corporativa completa
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                O objetivo é que os alunos e usuários do sistema possam explorar ao máximo as funcionalidades 
                das ferramentas desenvolvidas. Os cursos estão disponíveis em modalidade EAD e blended-learning, 
                com videoaulas, capturas de tela, materiais de leitura e avaliações.
              </p>
            </motion.div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit, i) => (
              <motion.div
                key={benefit}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                <span className="text-sm font-medium text-foreground">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-secondary/30">
        <div className="container py-20 lg:py-24">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Funcionalidades</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-foreground lg:text-4xl">
              Tudo para uma experiência completa
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }, i) => (
              <motion.div
                key={title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="group card-surface p-6 transition-all hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-nexti/10 transition-colors group-hover:bg-gradient-nexti">
                  <Icon className="h-6 w-6 text-primary transition-colors group-hover:text-primary-foreground" />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-nexti">
        <div className="container py-20 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="font-display text-3xl font-bold text-primary-foreground lg:text-4xl">
              Comece a aprender hoje
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base text-primary-foreground/80">
              Acesse trilhas de aprendizado, ganhe certificados e desenvolva suas competências profissionais.
            </p>
            <Link to="/auth">
              <Button
                size="lg"
                className="mt-8 bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-2 px-10 h-12 text-base font-semibold shadow-xl"
              >
                Acessar Plataforma
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 bg-card">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 py-8">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-nexti">
              <span className="text-xs font-bold text-primary-foreground">N</span>
            </div>
            <span className="font-display text-base font-bold text-foreground">Universidade Nexti</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Nexti. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
