// Onboarding rules: shown once per user, controlled by profiles.onboarding_completed (database, not browser storage).

export interface InterestArea {
  key: string;
  label: string;
  description: string;
}

/** Keys must match the allowed list in the complete_onboarding database function. */
export const INTEREST_AREAS: InterestArea[] = [
  { key: "gestao_pessoas", label: "Gestão de Pessoas", description: "Administração de colaboradores, cadastros e informações dos profissionais." },
  { key: "departamento_pessoal", label: "Departamento Pessoal", description: "Rotinas de DP, dados cadastrais e processos dos colaboradores." },
  { key: "controle_jornada", label: "Controle de Jornada", description: "Registro de ponto, jornadas, escalas e horários." },
  { key: "escalas_frequencia", label: "Escalas e Frequência", description: "Escalas de trabalho, frequência e acompanhamento de equipes." },
  { key: "gestao_beneficios", label: "Gestão de Benefícios", description: "Administração e acompanhamento dos benefícios dos colaboradores." },
  { key: "admissao_digital", label: "Admissão Digital", description: "Processos admissionais, documentação e integração de novos colaboradores." },
  { key: "gestao_equipes", label: "Gestão de Equipes", description: "Acompanhamento de equipes, indicadores e informações gerenciais." },
  { key: "relatorios_indicadores", label: "Relatórios e Indicadores", description: "Análise de dados, relatórios gerenciais e resultados." },
  { key: "gestao_acessos", label: "Gestão de Acessos", description: "Usuários, permissões, perfis e segurança de acesso." },
  { key: "tecnologia_nexti", label: "Tecnologia e Funcionalidades Nexti", description: "Recursos, ferramentas e funcionalidades da plataforma." },
];

/** Show onboarding only after the profile has loaded and it is not marked as completed. */
export function shouldShowOnboarding(profile: { onboarding_completed?: boolean | null } | null | undefined): boolean {
  if (!profile) return false;
  return profile.onboarding_completed !== true;
}

export function toggleInterestArea(selected: string[], key: string): string[] {
  return selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
}
