import { Link } from "react-router-dom";
import { RefreshCw, Layers, Clock, MessageCircle, Award, ShieldCheck } from "lucide-react";
import heroImage from "@/assets/hero-universidade.jpg";

const benefits = [
  { icon: RefreshCw, title: "Atualização", description: "Atualização constante de conteúdo e cursos cada vez mais direcionados." },
  { icon: Layers, title: "Flexibilidade", description: "Modularização das aulas para públicos específicos." },
  { icon: Clock, title: "Disponibilidade", description: "Disponível em qualquer horário e em diversos dispositivos." },
  { icon: MessageCircle, title: "Suporte", description: "Suporte ao aluno em horários específicos através de e-mail e chat." },
  { icon: Award, title: "Certificação", description: "Certificado disponível após a conclusão do curso." },
  { icon: ShieldCheck, title: "Acesso controlado", description: "Acesso restrito ao ambiente virtual e controle de inscrições." },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-card">
      {/* Header */}
      <header className="bg-card border-b border-border/30">
        <div className="container flex h-16 items-center">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-extrabold text-primary tracking-tight">nexti</span>
          </div>
        </div>
      </header>

      {/* Hero — gray background like original */}
      <section className="bg-secondary">
        <div className="container grid grid-cols-1 items-center gap-8 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground lg:text-4xl">
              Universidade Nexti
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
              A Universidade NEXTI oferece cursos de capacitação sobre produtos e fundamentos relacionados ao que a empresa desenvolve.
            </p>
            <Link
              to="/auth"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Acessar
            </Link>
          </div>
          <div className="flex justify-end">
            <img
              src={heroImage}
              alt="Profissionais estudando juntos em um laptop"
              className="w-full max-w-lg rounded-md object-cover"
            />
          </div>
        </div>
      </section>

      {/* Sobre o Projeto */}
      <section className="bg-card">
        <div className="container py-16 lg:py-20">
          <h2 className="font-display text-2xl font-bold text-foreground lg:text-3xl">
            Sobre o Projeto - Universidade Nexti
          </h2>

          <div className="mt-8 max-w-3xl border-l-4 border-primary pl-6 space-y-4">
            <p className="text-base leading-relaxed text-muted-foreground">
              O objetivo é que os alunos e usuários do sistema possam explorar ao máximo as funcionalidades das ferramentas desenvolvidas, incluindo sua aplicabilidade.
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              Os cursos estão disponibilizados em duas modalidades: totalmente a distância e blended-learning. Na modalidade totalmente a distância, os cursos trazem videoaulas, capturas de tela com narração, materiais de leitura, animações e provas. No B-learning, associamos os cursos a distância com aulas presenciais de prática e aplicação dos conteúdos, chamado de operação assistida.
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              Todos os cursos possuem certificado de conclusão, incluindo os requisitos para sua validação: nome do aluno, nome do curso, data de conclusão, carga horária, assinaturas e um código de validação.
            </p>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="bg-secondary/50">
        <div className="container py-16 lg:py-20">
          <h2 className="font-display text-2xl font-bold text-foreground text-center lg:text-3xl">
            Benefícios
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, title, description }) => (
              <div key={title} className="card-surface p-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 bg-card">
        <div className="container flex items-center justify-between py-6">
          <span className="font-display text-lg font-extrabold text-primary">nexti</span>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Nexti. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
